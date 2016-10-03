'use strict';

const Promise = require('bluebird');
const http = require('http');
const mime = require('mime');


function getMethods(app, req) {
  let methods = [];
  getPaths(req).forEach(route => {
    if (app.controllerRoutes[route]) {
      app.controllerRoutes[route].forEach(method =>{
        methods.push((component) => {
          bolt.fire("firingControllerMethod", method.method.methodPath, bolt.getPathFromRequest(req));
          component.__componentName = component.component || method.method.componentName;
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
  return method(config.component).then(component => {
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

function addSendMethod(res, message, socket, method) {
  res.send = data=>{
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

function addTypeMethod(res) {
  res.type = type=>{
    res.headers['content-type'] = mime.lookup(type);
    return res
  };

  return res;
}

function addGetHeader(res) {
  res.getHeader = headerName=>{
    res.headers[headerName];
  };

  return res;
}

function addStatusMethod(res) {
  res.status = statusCode=>{
    res.statusCode=statusCode;
    return res;
  };

  return res;
}

function createSocketResponse(message, socket, method) {
  let res = {
    headers: {},
    headersSent: false,
    end: ()=>{},
    statusCode: 200
  };

  addJsonMethod(res, message, socket, method);
  addSendMethod(res, message, socket, method);
  addTypeMethod(res);
  addGetHeader(res);
  addStatusMethod(res);

  return res;
}

function createSocketResquest(message, socket, method) {
  let req = Object.assign(socket.request, {
    method,
    orginalUrl: message.path,
    body: message.body,
    path: message.path,
    websocket: socket
  });

  return req;
}

function boltRouter(app) {
  http.METHODS
    .map(method=>method.toLowerCase())
    .forEach(method=> {
      bolt.ioOn(method, (socket, message)=> {
        let res = createSocketResponse(message, socket, method);
        let req = Object.assign(socket.request, createSocketResquest(message, socket, method));
        res.req = res;
        req.res = res;
        req.app = app;

        let methods = getMethods(app, req);
        let component = {req, res, done: false};
        if (methods.length) callMethod({
          methods, component, req, res, next:()=>{}
        });
      });
    });

  return (req, res, next)=>{
    let methods = getMethods(app, req);
    let component = bolt.addTemplateFunctions({req, res, done: false});
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
