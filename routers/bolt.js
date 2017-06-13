'use strict';

const Promise = require('bluebird');
const http = require('http');
const mime = require('mime');
const typeis = require('type-is');


function getMethods(app, req) {
  let methods = [];
  getPaths(req).forEach(route => {
    if (app.controllerRoutes[route]) {
      app.controllerRoutes[route].forEach(method =>{
        methods.push((component) => {
          bolt.fire('firingControllerMethod', method.method.methodPath, bolt.getPathFromRequest(req));
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
  function send(content) {
    let data;
    if (config.component.sendFields) {
      data = bolt.pick(config.component.req.doc, bolt.makeArray(config.component.sendFields));
      if (content) Object.assign(data, {content});
    } else {
      data = content;
    }

    if (config.req.isWebSocket) data.messageId = config.req.messageId;

    return config.res
      .status(config.component.status || 200)
      .send(data || config.component.statusMessage)
      .end();
  }

  if (config.component.template) {
    return config.req.app.applyTemplate(config.component, config.req).then(send);
  } else if (config.component.sendFields) {
    return(send);
  }
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
      return config.res
        .redirect(config.component.status || 302, config.component.redirect)
        .end();
    } else if (config.component.done && !config.component.res.headersSent) {
      return applyAndSend(config);
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
    statusCode: 200,
    set: (headerName, value)=>{
      res.headers[headerName] = value;
    },
    websocket: socket,
    isSocket: true
  };

  addJsonMethod(res, message, socket, method);
  addSendMethod(res, message, socket, method);
  addTypeMethod(res);
  addGetHeader(res);
  addStatusMethod(res);

  return res;
}

function getContentLength(message) {
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

function createSocketResquest(message, socket, method) {
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
  req.headers['content-length'] = getContentLength(message);
  req.is = test=>typeis(req, test);

  return req;
}

const _componentAllowedToSet = [
  'done', 'status', 'stausMessage', 'header', 'mime'
];

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

function _setMime(mimeType) {
  this.res.set('Content-Type', mime.lookup(mimeType));
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
        let component = {req, res, done:false};
        component.set = _componentSet.bind(component);
        component.mime = _setMime.bind(component);

        if (methods.length) callMethod({
          methods, component, req, res, next:()=>{}
        });
      });
    });

  return (req, res, next)=>{
    let methods = getMethods(app, req);
    let component = bolt.addTemplateFunctions({req, res, done:false});
    component.set = _componentSet.bind(component);
    component.mime = _setMime.bind(component);
    res.isSocket = false;

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
