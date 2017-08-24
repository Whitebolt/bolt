'use strict';

const Promise = require('bluebird');
const http = require('http');
const mime = require('mime');

const _componentAllowedToSet = [
  'done', 'status', 'stausMessage', 'header', 'mime'
];

/**
 * Get an array of methods (in order) to fire for a give request path.
 *
 * @private
 * @param {Object} app          Express application object the request relates to.
 * @param {Object} req          The express request object.
 * @returns {Array.<Function>}  Methods that are applicable to request route.
 */
function _getMethods(app, req) {
  let methods = [];
  let cascading = new Map();

  _getPaths(req).forEach(route=>{
    if (app.controllerRoutes[route]) {
      app.controllerRoutes[route].forEach(method=>{
        let methodPath = bolt.annotation.get(method.method, 'methodPath');
        let add = true;

        if (!cascading.has(methodPath)) {
          cascading.set(methodPath, !!bolt.annotation.get(method.method, 'cascade'));
        } else {
          add = cascading.get(methodPath);
        }

        if (add) {
          methods.push(router=>{
            bolt.fire('firingControllerMethod', bolt.annotation.get(method.method, 'methodPath'), bolt.getPathFromRequest(req));
            router.__componentName = router.component || bolt.annotation.get(method.method, 'componentName');
            router.componentPath = bolt.annotation.get(method.method, 'componentPath');
            return method.method(router);
          });
        }
      });
    }
  });
  return methods;
}

/**
 * Apply current route, sending data back to client.
 *
 * @private
 * @param {Object} router   Router object.
 * @returns {*}
 */
function applyAndSend(router) {
  let {req, res} = router;

  function send(content={}) {
    let data;
    if (router.sendFields) {
      data = bolt.pick(req.doc, bolt.makeArray(router.sendFields));
      if (content) Object.assign(data, {content});
    } else {
      data = content;
    }

    if (router.redirect) data.redirect = router.redirect;
    if (req.isWebSocket && !bolt.isString(data)) data.messageId = req.messageId;

    return res
      .status(router.status || 200)
      .send(data || router.statusMessage)
      .end();
  }

  if (router.template) {
    return req.app.applyTemplate(router, req).then(send);
  } else if (router.sendFields) {
    return send();
  }
}

/**
 * Handle any errors.
 *
 * @param {Error} error     Error object to handle.
 * @param {Object} config   Route config object.
 */
function handleMethodErrors(error, config) {
  console.error(error);
  config.next();
}

/**
 * Get all possible paths for given express request object in order.  Routes cascade so /test1/test2/test3 can fire
 * component controllers for /test1/test2/test3, /test1/test2 and /test1.
 *
 * @private
 * @param {Object} req          Express request object.
 * @returns {Array.<string>}    Possible routes in cascading order.
 */
function _getPaths(req) {
  let route = bolt.getPathFromRequest(req);
  let routes = [];
  while (route.length) {
    routes.push(route);
    let routeParts = route.split('/');
    routeParts.pop();
    route = routeParts.join('/')
  }
  routes.push('/');
  return routes;
}

/**
 * Call the next method or run applyAndSend if done.
 *
 * @param {Object} config       Router config object.
 * @returns {Promise}           Promise resolving when data has been sent back to user.
 */
function callMethod(config) {
  let method = Promise.method(config.methods.shift());

  return method(config.router).then(router=>{
    if (config.router.redirect) {
      let redirect = config.res.redirect(config.router.status || 302, config.router.redirect);
      return ((redirect && redirect.end)?redirect.end():redirect);
    } else if (config.router.done && !config.router.res.headersSent) {
      return applyAndSend(router);
    } else if (config.methods.length && !config.router.done && !config.router.res.headersSent) {
      return callMethod(config);
    } else {
      return config.router;
    }
  }, error=>handleMethodErrors(error, config));
}

/**
 * Set method assigned to component object passed to controller methods. Method can be used to set headers in the
 * server responses.
 *
 * @public
 * @param {string|object} values    The value name to set or object of key/value pairs to set.
 * @param {*} [value]               Value to set or header property name if setting a header value.
 * @param {*} [headerValue]         If values is set to header then this is the value to use for header.
 * @private
 */
function _componentSet(values, value, headerValue) {
  if (value !== undefined) {
    if (values === 'header') {
      this.res.set(value, headerValue);
    } else if (values === 'mime') {
      this.res.set('Content-Type', mime.lookup(value));
    } else {
      this[values] = value;
    }
  } else {
    _componentAllowedToSet.forEach(key=>{
      if (values.hasOwnProperty(key)) {
        if (key === 'header') {
          Object.keys(values[key] || {}).forEach(header=>
            this.res.set(header, values[key][header])
          );
        } else if (key === 'mime') {
          this.res.set('Content-Type', mime.lookup(values[key]));
        } else {
          this[key] = values[key];
        }
      }
    });
  }
}

/**
 * Set the bound object.  Function is meant to be bound to a component object passed to routers.
 *
 * @public
 * @param {string} mimeType   Mimetype to use.
 * @private
 */
function setMime(mimeType) {
  this.res.set('Content-Type', mime.lookup(mimeType));
}


/**
 * Create the router object, which is passed around route methods.
 *
 * @private
 * @param {Object} req        Express request object.
 * @param {Object} res        Express response object.
 * @param {Object} [socket]   Socket.io object if this is a socket.io route.
 * @returns {Object}          Router object
 */
function _createRouterObject(req, res, socket) {
  let router = bolt.addTemplateFunctions({req, res, done:false});
  router.set = _componentSet.bind(router);
  router.mime = setMime.bind(router);

  res.isWebSocket = !!socket;

  return router;
}

/**
 * Function to run when a socket.io message is received matching a http method.
 *
 * @private
 * @param {bolt:application} app            Express application.
 * @param {string} method                   Http method name.
 * @param {Object} socket                   The socket.io object.
 * @param {Object} message                  The socket.io message.
 * @param {Function} [callback]             Socket.io callback method.
 */
function _socketRouterMethod(app, method, socket, message, callback) {
  let {res, req, next} = bolt.createWebsocketRouterObjects(app, message, socket, method, callback);
  let methods = _getMethods(app, req);
  let router = _createRouterObject(req, res, socket);
  let config = {methods, router, req, res, next, callback};

  if (methods.length) callMethod(config);
}


/**
 * Add socket.io routing, which mimics the ordinary ajax style routing as closely as possible.
 *
 * @private
 * @param {bolt:application} app    Express application object.
 * @returns {bolt:application} app  The express application object passed to this function.
 */
function _addSocketIoMethodRouters(app) {
  http.METHODS.forEach(method=>bolt.ioOn(method.toLowerCase(), _socketRouterMethod.bind({}, app, method)));
}

/**
 * The bolt router. This will fire return a router function that fires components, controllers and methods according
 * to the bolt routing rules.
 *
 * @private
 * @param {bolt:application} app    Express application object.
 * @returns {Function}              Express router function.
 */
function _httpRouter(app) {
  return (req, res, next)=>{
    let methods = _getMethods(app, req);
    let router = _createRouterObject(req, res);
    let config = {methods, router, req, res, next};

    if (methods.length) {
      callMethod(config).then(router=>{
        if (router && router.res && !router.res.headersSent) next();
      });
    } else {
      next();
    }
  };
}

/**
 * The bolt router. This will fire return a router function that fires components, controllers and methods according
 * to the bolt routing rules. Routing is mimicked as closely as possible in socket.io so routing can transparent
 * for either ajax or websocket.
 *
 * @public
 * @param {bolt:application} app    Express application object.
 * @returns {Function}              Express router function.
 */
function boltRouter(app) {
  // @annotation priority 0

  _addSocketIoMethodRouters(app);
  return _httpRouter(app);
}

module.exports = boltRouter;
