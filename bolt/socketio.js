'use strict';

const mime = require('mime');

/**
 * @module bolt/bolt
 */

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
 * Create an express like response object to use in socket.io requests.  This basically fakes the express
 * response object.
 *
 * @private
 * @param {Object} socket         The socket.io socket.
 * @returns {Object}              The express like response object.
 */
function createSocketIoResponse(socket) {
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
          middleware(socket.request, createSocketIoResponse(socket), next);
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
  ioUse, use, ioOn
};