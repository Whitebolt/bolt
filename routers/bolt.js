'use strict';

const Promise = require('bluebird');
const http = require('http');
const mime = require('mime');
const typeis = require('type-is');

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
  _getPaths(req).forEach(route => {
    if (app.controllerRoutes[route]) {
      app.controllerRoutes[route].forEach(method=>{
        methods.push(router=>{
          bolt.fire('firingControllerMethod', method.method.methodPath, bolt.getPathFromRequest(req));
          router.__componentName = router.component || method.method.componentName;
          router.componentPath = method.method.componentPath;
          return method.method(router);
        });
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
    if (req.isWebSocket) data.messageId = req.messageId;

    return res
      .status(router.status || 200)
      .send(data || router.statusMessage)
      .end();
  }

  if (router.template) {
    return req.app.applyTemplate(router, req).then(send);
  } else if (router.sendFields) {
    return send;
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
      return config.res
        .redirect(config.router.status || 302, config.router.redirect)
        .end();
    } else if (config.router.done && !config.router.res.headersSent) {
      return applyAndSend(router);
    } else if (config.methods.length && !config.router.done && !config.router.res.headersSent) {
      return callMethod(config);
    } else {
      return config.router;
    }
  }, error => handleMethodErrors(error, config));
}

/**
 * Add json() method to socket response object.  This is part of faking the express response object in socket.io routes.
 * Added method duplicates the express json() method for use in socket.io route.
 *
 * @public
 * @param {Object} res        An express like response object.  This is not an express response object but is like one.
 * @param {Object} message    The socket.io message object.
 * @param {Object} socket     The socket.io socket.
 * @param {string} method     The socket.io message type.
 * @returns {Object}          The express like response object, mutated to include json() method.
 */
function addJsonMethod(res, message, socket, method) {
  res.json = data=>{
    socket.emit(method, {
      type: 'application/json',
      status: res.statusCode,
      path: message.path,
      body: data
    });
    return res;
  };
  return res;
}

/**
 * Add send() method to socket response object.  This is part of faking the express response object in socket.io routes.
 * Added method duplicates the express send() method for use in socket.io route.
 *
 * @public
 * @param {Object} res        An express like response object.  This is not an express response object but is like one.
 * @param {Object} message    The socket.io message object.
 * @param {Object} socket     The socket.io socket.
 * @param {string} method     The socket.io message type.
 * @returns {Object}          The express like response object, mutated to include send() method.
 */
function addSendMethod(res, message, socket, method) {
  res.send = data=>{
    console.log("SENDING", method, message);
    socket.emit(method, {
      type: 'application/json',
      status: res.statusCode,
      path: message.path,
      body: data
    });
    return res;
  };
  return res;
}

/**
 * Add type() method to socket response object.  This is part of faking the express response object in socket.io routes.
 * Added method duplicates the express type() method for use in socket.io route.
 *
 * @public
 * @param {Object} res        An express like response object.  This is not an express response object but is like one.
 * @param {Object} message    The socket.io message object.
 * @param {Object} socket     The socket.io socket.
 * @param {string} method     The socket.io message type.
 * @returns {Object}          The express like response object, mutated to include type() method.
 */
function addTypeMethod(res) {
  res.type = type=>{
    res.headers['content-type'] = mime.lookup(type);
    return res
  };

  return res;
}

/**
 * Add getHeader() method to socket response object.  This is part of faking the express response object in
 * socket.io routes. Added method duplicates the express getHeader() method for use in socket.io route.
 *
 * @public
 * @param {Object} res        An express like response object.  This is not an express response object but is like one.
 * @returns {Object}          The express like response object, mutated to include getHeader() method.
 */
function addGetHeader(res) {
  res.getHeader = headerName=>{
    res.headers[headerName];
  };

  return res;
}

/**
 * Add status() method to socket response object.  This is part of faking the express response object in socket.io
 * routes. Added method duplicates the express status() method for use in socket.io route.
 *
 * @public
 * @param {Object} res        An express like response object.  This is not an express response object but is like one.
 * @returns {Object}          The express like response object, mutated to include status() method.
 */
function addStatusMethod(res) {
  res.status = statusCode=>{
    res.statusCode=statusCode;
    return res;
  };

  return res;
}

/**
 * Create an express like response object to use in socket.io routes.  This basically fakes the express response object
 * so the same routes can be used in socket.io and ajax.
 *
 * @private
 * @param {Object} message    The socket.io message object.
 * @param {Object} socket     The socket.io socket.
 * @param {string} method     The socket.io message type.
 * @returns {Object}          The express like response object.
 */
function _createSocketResponse(message, socket, method) {
  let res = {
    headers: {},
    headersSent: false,
    end: ()=>{},
    statusCode: 200,
    set: (headerName, value)=>{
      res.headers[headerName] = value;
    },
    websocket: socket,
    isWebSocket: true,
    redirect:(status, redirect)=>{
      res.statusCode = status;
      message.path = redirect;
      return res.send({messageId:message.messageId});
    }
  };

  addJsonMethod(res, message, socket, method);
  addSendMethod(res, message, socket, method);
  addTypeMethod(res);
  addGetHeader(res);
  addStatusMethod(res);



  return res;
}

/**
 * Get the length of a message object. Used to fake the content-length header in socket.io routes.
 *
 * @private
 * @param {*} message     Message to get length of.  This is assumed to be an object.
 * @returns {number}      Message length.
 */
function _getContentLength(message) {
  var txt;
  try {
    txt = JSON.stringify(message);
  } catch(error) {
    try {
      txt = message.toString();
    } catch(error) {
      txt = " ";
    }
  }
  return txt.toString().length;
}

/**
 * Create an express like request object to use in socket.io routes.  This basically fakes the express response object
 * so the same routes can be used in socket.io and ajax.
 *
 * Object takes some of its data from the original request object given by socket.io.
 *
 * @private
 * @param {Object} message    The socket.io message object.
 * @param {Object} socket     The socket.io socket.
 * @param {string} method     The socket.io message type.
 * @returns {Object}          The express like request object.
 */
function _createSocketResquest(message, socket, method) {
  let req = Object.assign(socket.request, {
    method,
    orginalUrl: message.path,
    body: message.body || {},
    path: message.path,
    websocket: socket,
    messageId: message.messageId
  });

  req.headers['content-type'] = 'application/json';
  req.headers['transfer-encoding'] = 'identity';
  req.headers['content-length'] = _getContentLength(message);
  req.is = test=>typeis(req, test);

  return req;
}

const _componentAllowedToSet = [
  'done', 'status', 'stausMessage', 'header', 'mime'
];

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
 * Add socket.io routing, which mimics the ordinary ajax style routing as closely as possible.
 *
 * @private
 * @param {Object} app    Express application object.
 * @returns {Object} app  The express application object passed to this function.
 */
function _boltRouterSocketIo(app) {
  http.METHODS
    .map(method=>method.toLowerCase())
    .forEach(method=> {
      bolt.ioOn(method, (socket, message)=> {
        let res = _createSocketResponse(message, socket, method);
        let req = Object.assign(socket.request, _createSocketResquest(message, socket, method));
        res.req = res;
        req.res = res;
        req.app = app;

        let methods = _getMethods(app, req);
        let router = {req, res, done:false};
        router.set = _componentSet.bind(router);
        router.mime = setMime.bind(router);

        if (methods.length) callMethod({
          methods, router, req, res, next:()=>{}
        });
      });
    });
}

/**
 * The bolt router. This will fire return a router function that fires components, controllers and methods according
 * to the bolt routing rules.
 *
 * @private
 * @param {Object} app    Express application object.
 * @returns {Function}    Express router function.
 */
function _boltRouterHttp(app) {
  return (req, res, next)=>{
    let methods = _getMethods(app, req);
    let router = bolt.addTemplateFunctions({req, res, done:false});
    router.set = _componentSet.bind(router);
    router.mime = setMime.bind(router);
    res.isWebSocket = false;

    if (methods.length) {
      callMethod({methods, router, req, res, next})
        .then(router=>{
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
 * @param {Object} app    Express application object.
 * @returns {Function}    Express router function.
 */
function boltRouter(app) {
  _boltRouterSocketIo(app);
  return _boltRouterHttp(app);
}

boltRouter.priority = 0;

module.exports = boltRouter;
