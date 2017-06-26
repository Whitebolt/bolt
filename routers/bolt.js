'use strict';

const Promise = require('bluebird');
const http = require('http');
const mime = require('mime');
const typeis = require('type-is');

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
function socketIoResJsonMethod(res, message, socket, method) {
  return data=>{
    socket.emit(method, {
      type: 'application/json',
      status: res.statusCode,
      path: message.path,
      body: data
    });
    return res;
  };
}

/**
 * Add send() method to socket response object.  This is part of faking the express response object in socket.io routes.
 * Added method duplicates the express send() method for use in socket.io route.
 *
 * @public
 * @param {Object} res            An express like response object.  This is not an express response object
 *                                but is like one.
 * @param {Object} message        The socket.io message object.
 * @param {Object} socket         The socket.io socket.
 * @param {string} method         The socket.io message type.
 * @param {Function} [callback]   Socket.io callback method.
 * @returns {Object}              The express like response object, mutated to include send() method.
 */
function socketIoSendMethod(res, message, socket, method, callback) {
  return data=>{
    let response = {
      type: res.headers['content-type'],
      status: res.statusCode,
      path: message.path,
      body: data
    };

    if (callback) {
      callback(response);
    } else {
      socket.emit(method, response);
    }

    return res;
  };
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
function socetIoTypeMethod(res) {
  return type=>{
    res.headers['content-type'] = mime.lookup(type);
    return res
  };
}

/**
 * Add getHeader() method to socket response object.  This is part of faking the express response object in
 * socket.io routes. Added method duplicates the express getHeader() method for use in socket.io route.
 *
 * @public
 * @param {Object} res        An express like response object.  This is not an express response object but is like one.
 * @returns {Object}          The express like response object, mutated to include getHeader() method.
 */
function socketIoGetHeaderMethod(res) {
  return headerName=>{
    res.headers[headerName];
  };
}

/**
 * Add status() method to socket response object.  This is part of faking the express response object in socket.io
 * routes. Added method duplicates the express status() method for use in socket.io route.
 *
 * @public
 * @param {Object} res        An express like response object.  This is not an express response object but is like one.
 * @returns {Object}          The express like response object, mutated to include status() method.
 */
function socketIoStatusMethod(res) {
  return statusCode=>{
    res.statusCode=statusCode;
    return res;
  };
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
  let req = {
    body: message.body || {},
    headers: Object.assign(socket.request, {
      'content-type': 'application/json',
      'transfer-encoding': 'identity',
      'content-length': _getContentLength(message)
    }),
    is: test=>typeis(req, test), // @todo Test for memory leak here.
    isWebSocket: true,
    method,
    messageId: message.messageId,
    orginalUrl: message.path,
    path: message.path,
    websocket: socket
  };

  return new Proxy(req, {
    get: (target, property)=>{
      return target[property] || socket.request[property];
    }
  });
}

/**
 * Create an express like response object to use in socket.io routes.  This basically fakes the express response object
 * so the same routes can be used in socket.io and ajax.
 *
 * @private
 * @param {Object} message        The socket.io message object.
 * @param {Object} socket         The socket.io socket.
 * @param {string} method         The socket.io message type.
 * @param {Function} [callback]   Socket.io callback method.
 * @returns {Object}              The express like response object.
 */
function _createSocketResponse(message, socket, method, callback) {
  let res = {};

  return Object.assign(res, {
    end: ()=>{},
    getHeader: socketIoGetHeaderMethod(res),
    headers: {},
    headersSent: false,
    isWebSocket: true,
    json: socketIoResJsonMethod(res, message, socket, method),
    redirect:(status, redirect)=>{
      res.statusCode = status;
      message.path = redirect;
      return res.send({messageId:message.messageId});
    },
    send: socketIoSendMethod(res, message, socket, method, callback),
    set: (headerName, value)=>{
      res.headers[headerName] = value;
    },
    status: socketIoStatusMethod(res),
    statusCode: 200,
    type: socetIoTypeMethod(res),
    websocket: socket
  });
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
 * Add references to each other in the res and req object as is normal for express style resquest and response objects.
 * This basically mimics express objects in socket.io routes.
 *
 * @private
 * @param {Object} router     Router object containing express req, res and next object/function.
 * @param {Object} app        Express application object.
 * @returns {Object}          Router object comprising of {req, res, next}.
 */
function _addReqResReferences(router, app) {
  router.res.req = router.res;
  router.req.res = router.res;
  router.req.app = app;

  return router;
}

/**
 * Create res, req and next as found in Express-style routes. This is for use in socket.io routing.
 *
 * @prvate
 * @param {Object} message        The socket.io message received.
 * @param {Object} socket         The socket.io object.
 * @param {string} method         The method name.
 * @param {Function} [callback]   Socket.io callback method.
 */
function _createSocketIoReqResNextObjects(message, socket, method, callback) {
  return {
    req: _createSocketResquest(message, socket, method),
    res: _createSocketResponse(message, socket, method, callback),
    next: ()=>{}
  };
}

/**
 * Function to run when a socket.io message is received matching a http method.
 *
 * @private
 * @param {Object} app            Express application.
 * @param {string} method         Http method name.
 * @param {Object} socket         The socket.io object.
 * @param {Object} message        The socket.io message.
 * @param {Function} [callback]   Socket.io callback method.
 */
function _socketRouterMethod(app, method, socket, message, callback) {
  let {res, req, next} = _createSocketIoReqResNextObjects(message, socket, method, callback);
  let methods = _getMethods(app, req);
  let router = _addReqResReferences(_createRouterObject(req, res, socket), app);
  let config = {methods, router, req, res, next, callback};

  if (methods.length) callMethod(config);
}


/**
 * Add socket.io routing, which mimics the ordinary ajax style routing as closely as possible.
 *
 * @private
 * @param {Object} app    Express application object.
 * @returns {Object} app  The express application object passed to this function.
 */
function _addSocketIoMethodRouters(app) {
  http.METHODS.forEach(method=>bolt.ioOn(method.toLowerCase(), _socketRouterMethod.bind({}, app, method)));
}

/**
 * The bolt router. This will fire return a router function that fires components, controllers and methods according
 * to the bolt routing rules.
 *
 * @private
 * @param {Object} app    Express application object.
 * @returns {Function}    Express router function.
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
 * @param {Object} app    Express application object.
 * @returns {Function}    Express router function.
 */
function boltRouter(app) {
  _addSocketIoMethodRouters(app);
  return _httpRouter(app);
}

boltRouter.priority = 0;

module.exports = boltRouter;
