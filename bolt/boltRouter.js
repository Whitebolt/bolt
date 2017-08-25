'use strict';

const mime = require('mime');

const _componentAllowedToSet = [
  'done', 'status', 'stausMessage', 'header', 'mime'
];

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
 * Apply current route, sending data back to client.
 *
 * @public
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
 * Set method assigned to component object passed to controller methods. Method can be used to set headers in the
 * server responses.
 *
 * @public
 * @param {string|object} values    The value name to set or object of key/value pairs to set.
 * @param {*} [value]               Value to set or header property name if setting a header value.
 * @param {*} [headerValue]         If values is set to header then this is the value to use for header.
 * @private
 */
function componentSet(values, value, headerValue) {
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
 * Create the router object, which is passed around route methods.
 *
 * @public
 * @param {Object} req        Express request object.
 * @param {Object} res        Express response object.
 * @param {Object} [socket]   Socket.io object if this is a socket.io route.
 * @returns {Object}          Router object
 */
function createRouterObject(req, res, socket) {
  let router = bolt.addTemplateFunctions({req, res, done:false});
  router.set = componentSet.bind(router);
  router.mime = setMime.bind(router);

  return router;
}

/**
 * Get an array of methods (in order) to fire for a give request path.
 *
 * @public
 * @param {Object} app          Express application object the request relates to.
 * @param {Object} req          The express request object.
 * @returns {Array.<Function>}  Methods that are applicable to request route.
 */
function getMethods(app, req, filter) {
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

        if (filter) add = !!filter(method.method);

        if (add) {
          methods.push(router=>{
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

module.exports = {
  boltRouter: {
    getMethods, createRouterObject, applyAndSend
  }
};