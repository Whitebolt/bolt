'use strict';

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

function ioOn(messageName, handler) {
  bolt.hook('afterIoServerLaunch', (event, app)=>{
    app.io.on('connection', socket=>{
      socket.on(messageName, data=>handler(socket, data));
    });
  });
}

function use(app, ...middleware) {
  app.use.apply(app, middleware);
  ioUse.bind({}, app).apply({}, middleware);
}

module.exports = {
 ioUse, use, ioOn
};