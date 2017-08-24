'use strict';

const mime = require('mime');
const typeis = require('type-is');

const _authMethods = [
  'login', 'logIn', 'logout', 'logOut', 'isAuthenticated', 'isUnauthenticated'
];

/**
 * @module bolt/bolt
 */

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
 * Add setHeader() method to socket response object.  This is part of faking the express response object in
 * socket.io routes. Added method duplicates the express setHeader() method for use in socket.io route.
 *
 * @public
 * @param {Object} res        An express like response object.  This is not an express response object but is like one.
 * @returns {Object}          The express like response object, mutated to include setHeader() method.
 */
function socketIoSetHeaderMethod(res) {
  return (headerName, value)=>{
    res.headers[headerName] = value;
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
function _createSocketIoResquest(message, socket, method) {
  let req = {
    body: message.body || {},
    headers: Object.assign({}, socket.request.headers, {
      'content-type': 'application/json',
      'transfer-encoding': 'identity',
      'content-length': _getContentLength(message)
    }),
    is: test=>!!typeis(req, test), // @todo Test for memory leak here.
    isWebSocket: true,
    method,
    messageId: message.messageId,
    orginalUrl: message.path,
    path: message.path,
    websocket: socket
  };

  return bolt.mergeWith({}, socket.request, req, (objValue, srcValue, key, object)=>{
    if (bolt.isFunction(srcValue)) {
      if (bolt.indexOf(_authMethods, key) !== -1) return srcValue.bind(socket.request);
      return srcValue.bind(object);
    }
  });
}

/**
 * Create an express like response object to use in socket.io requests.  This basically fakes the express
 * response object.
 *
 * @private
 * @param {Object} socket         The socket.io socket.
 * @returns {Object}              The express like response object.
 */
function _createSocketIoResponse(socket) {
  let res = {};

  return Object.assign(res, {
    end: ()=>{},
    getHeader: socketIoGetHeaderMethod(res),
    get: socketIoGetHeaderMethod,
    headers: {},
    headersSent: false,
    isWebSocket: true,
    set: socketIoSetHeaderMethod,
    status: socketIoStatusMethod(res),
    statusCode: 200,
    type: socetIoTypeMethod(res),
    websocket: socket,
    setHeader: socketIoSetHeaderMethod
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
function _createSocketIoResponseWithSend(message, socket, method, callback) {
  let res = _createSocketIoResponse(socket);

  return Object.assign(res, {
    json: socketIoResJsonMethod(res, message, socket, method),
    redirect:(status, redirect)=>{
      if (res.statusCode !== 401) res.statusCode = status;
      message.path = redirect;
      return res.send({messageId: message.messageId});
    },
    send: socketIoSendMethod(res, message, socket, method, callback)
  });
}

/**
 * Add references to each other in the res and req object as is normal for express style resquest and response objects.
 * This basically mimics express objects in socket.io routes.
 *
 * @private
 * @param {Object} routerObjects        Router object containing express req, res and next object/function.
 * @param {bolt:application} app        Express application object.
 * @returns {Object}                    Router object comprising of {req, res, next}.
 */
function _addReqResReferences(routerObjects, app) {
  routerObjects.res.req = routerObjects.res;
  routerObjects.req.res = routerObjects.res;
  routerObjects.req.app = app;

  return routerObjects;
}

/**
 * Create res, req and next as found in Express-style routes. This is for use in socket.io routing.
 *
 * @public
 * @param {BoltApplication} app   The bolt application
 * @param {Object} message        The socket.io message received.
 * @param {Object} socket         The socket.io object.
 * @param {string} method         The method name.
 * @param {Function} [callback]   Socket.io callback method.
 */
function createWebsocketRouterObjects(app, message, socket, method, callback) {
  const routerObjects = {
    req: _createSocketIoResquest(message, socket, method),
    res: _createSocketIoResponseWithSend(message, socket, method, callback),
    next: ()=>{}
  };

  _addReqResReferences(routerObjects, app);

  return routerObjects;
}

/**
 * Set middleware on a given socket after sockets are available.
 *
 * @public
 * @param {Object} app            The express application object.
 * @param {Function} middleware   The middleware function.
 */
function ioUse(app, ...middleware) {
  let init = ()=>{
    app.io.on('connection', socket=> {
      middleware.forEach(middleware=>{
        socket.use((packet, next)=>{
          socket.request.websocket = socket;
          middleware(socket.request, _createSocketIoResponse(socket), next);
        });
      });
    });
  };

  if (bolt.fired('afterIoServerLaunch')) return init();
  bolt.hook('afterIoServerLaunch', (event, app)=>init());
}

/**
 * Set a handler on websockets for the given event.  Applied after socket.io is
 * available and on an individual connection.
 *
 * @public
 * @param {string} messageName    The message type to listen for.
 * @param {Function} handler      The handler function.
 */
function ioOn(messageName, handler) {
  bolt.hook('afterIoServerLaunch', (event, app)=>
    app.io.on('connection', socket=>
      socket.on(messageName, (data, callback)=>handler(socket, data, callback))
    )
  );
}

/**
 * Express app.use() method, which applies to both standard routes and then
 * patches on socket.io routes as well.
 *
 * @public
 * @param {Object} app            Express application object.
 * @param {Function} middleware   The middleware function.
 */
function use(app, ...middleware) {
  app.use.apply(app, middleware);
  ioUse.bind({}, app).apply({}, middleware);
}

module.exports = {
  ioUse, use, ioOn, createWebsocketRouterObjects
};