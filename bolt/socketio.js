'use strict';

/**
 * @module bolt/bolt
 */

/**
 * Set middleware on a given socket after sockets are available.
 *
 * @public
 * @param {Object} app            The express application object.
 * @param {Function} middleware   The middleware function.
 */
function ioUse(app, ...middleware) {
  let init = ()=>{
    middleware.forEach(middleware=>{
      app.io.use((socket, next)=>{
        socket.request.websocket = socket;
        middleware(socket.request, {}, next);
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
  bolt.hook('afterIoServerLaunch', (event, app)=>{
    app.io.on('connection', socket=>{
      socket.on(messageName, (data, callback)=>handler(socket, data, callback));
    });
  });
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