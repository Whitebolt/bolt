'use strict';

const Promise = require('bluebird');


function getMethods(app, req) {
  let methods = [];
  getPaths(req).forEach(route => {
    if (app.controllerRoutes[route]) {
      app.controllerRoutes[route].forEach(method => {
        methods.push((component) => {
          bolt.fire("firingControllerMethod", method.method.methodPath, bolt.getPathFromRequest(req));
          component.component = component.component || method.method.componentName;
          component.componentPath = method.method.componentPath;
          return method.method(component);
        });
      });
    }
  });
  return methods;
}

function applyAndSend(config) {
  return config.req.app.applyTemplate(config.component, config.req).then(data => {
    config.res.send(data);
    config.res.end();
  });
}

function handleMethodErrors(error, config) {
  console.error(error);
  config.next();
}

function getPaths(req) {
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

function callMethod(config) {
  let method = Promise.method(config.methods.shift());
  return method(config.component).then(() => {
    if (config.component.redirect) {
      config.res.redirect(config.component.status || 302, config.component.redirect);
      return config.res.end();
    } else if (config.component.done && !config.component.res.headersSent) {
      return applyAndSend(config)
    } else if (config.methods.length && !config.component.done && !config.component.res.headersSent) {
      return callMethod(config);
    } else {
      return config.component;
    }
  }, error => handleMethodErrors(error, config));
}

function boltRouter(app) {
  bolt.hook('afterIoServerLaunch', (event, app)=>{
    app.io.on('connection', socket=>{
      Object.keys(app.controllerRoutes).forEach(path=>{
        socket.on(path, data=>{
          let res = {
            headersSent: false,
            send: data=>socket.emit(path, data),
            end: ()=>{}
          };
          let req = Object.assign(socket.request, {
            orginalUrl: path,
            body: data.body,
            path,
            app,
            res,
            webSocket: socket
          });

          let methods = getMethods(app, req);
          let component = {req, res, done: false};
          if (methods.length) callMethod({methods, component, req, res, next:()=>{}});
        });
      });
    });
  });

  return (req, res, next)=>{
    let methods = getMethods(app, req);
    let component = {req, res, done: false};
    if (methods.length) {
      callMethod({methods, component, req, res, next})
        .then(component=>{
          if (component && component.res && !component.res.headersSent) next();
        });
    } else {
      next();
    }
  };
}

boltRouter.priority = 0;

module.exports = boltRouter;
