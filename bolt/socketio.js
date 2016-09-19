'use strict';

function ioUse(app, middleware) {
  let init = ()=>{
    app.io.use((socket, next)=>middleware(socket.request, {}, next, socket));
  };

  if (bolt.fired('afterIoServerLaunch')) return init();
  bolt.hook('afterIoServerLaunch', (event, app)=>init());
}

function use(app, middleware) {
  app.use(middleware);
  ioUse(app, middleware);
}

module.exports = {
 ioUse, use
};