'use strict';

function injectorReflect(items, component, extraParams, method) {
  return bolt.toObjectMap(items, item=>[item, injectors[item](component, extraParams, method)]);
}

function db(component) {
  const _queryConfig = ()=>injectorReflect(['db', 'app', 'req', 'session'], component);
  const _getLogicFunction = (funcName, queryConfig={})=>bolt[funcName](Object.assign({}, _queryConfig(), queryConfig));

  const collectionLogic = {
    getDoc: (queryConfig={})=>_getLogicFunction('getDoc', queryConfig),
    getDocs: (queryConfig={})=>_getLogicFunction('getDocs', queryConfig),
    updateDoc: (queryConfig={})=>_getLogicFunction('updateDoc', queryConfig)
  };

  return new Proxy(component.req.app.db, {
    get(target, property, receiver) {
      if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
      if (Reflect.has(collectionLogic, property)) return Reflect.get(collectionLogic, property, receiver);
    }
  });
}

function getMethodPath(method) {
  const methodPathParts = bolt.annotation.get(method, 'methodPath').split('/').filter(part=>part);
  const firstIndexPos = methodPathParts.length -  [...methodPathParts].reverse().findIndex(part=>(part!=='index'));
  return '/' + methodPathParts.slice(0, firstIndexPos).join('/');
}

function values(component, extraParams, method) {
  const {path, query, body} = injectorReflect(['path', 'query', 'body'], component);
  const _path = component.viaView?component.viaViewPath:path;
  const pathObj = {};
  const pathMap = (bolt.annotation.get(method, 'path-map') || '').split('/').filter(part=>part);

  if (pathMap.length) {
    const methodPath = getMethodPath(method);
    const pathParts = _path.split('?').shift().replace(methodPath, '').split('/').filter(part=>part);
    pathParts.forEach((part, n)=>{
      if (pathMap[n]) pathObj[pathMap[n]] = part;
    })
  }

  return Object.assign({}, query || {}, bolt.getUrlQueryObject(_path) || {}, bolt.isObject(body)?body:{}, pathObj);
}

function isJson(component, extraParams, method) {
  const req = injectors.req(component);
  const values = injectors.values(component, extraParams, method);
  if (!values.hasOwnProperty('json')) {
    return !!((req.method.toLowerCase() === "post") && req.is('application/json') && req.body)
  } else {
    if (values.json === undefined) return true;
    return bolt.toBool(values.json);
  }
}

function display(component, extraParams, method) {
  const {isJson, viaView, res, doc, req, view} = injectorReflect(['isJson', 'viaView', 'res', 'doc', 'req', 'view'], component, extraParams, method);

  return async (docField, viewName)=>{
    if (isJson) return viaView?JSON.stringify(docField?doc[docField]:doc):res.json(docField?doc[docField]:doc);
    const html = await view(viewName, doc, req);
    return viaView?html:res.send(html);
  };
}

/**
 * Object of methods to map dynamic inclusion parameters in controllers to what should be actually supplied to the
 * controller method.
 *
 * @type {Object}
 */
const injectors = Object.freeze({
  req: component=>component.req,
  res: component=>component.res || component.req.res,
  component: component=>component,
  doc: component=>{
    component.req.doc = component.req.doc || {};
    return component.req.doc;
  },
  done: component=>{
    return (value=true)=>{component.done = !!value}
  },
  app: component=>component.req.app,
  path: component=>bolt.getPathFromRequest(component.req),
  db: component=>db(component),
  view: component=>component.view,
  config: component=>component.req.app.config,
  method: component=>(component.req.method || '').toLowerCase(),
  session: component=>{
    component.req.session = component.req.session || {};
    return component.req.session;
  },
  body: component=>{
    component.req.body = component.req.body || {};
    return component.req.body;
  },
  query: component=>{
    component.req.query = component.req.query || {};
    return component.req.query;
  },
  sessionId: component=>{
    const sessionID = component.req.sessionID;
    return sessionID;
  },
  params: (component, extraParams)=>{
    return extraParams;
  },
  parent: component=>{
    component.parent = component.parent || {};
    return component.parent;
  },
  values: (...params)=>values(...params),
  viaView: component=>!!component.viaView,
  isJson: (...params)=>isJson(...params),
  display: (...params)=>display(...params)
});

module.exports = (params, component, extraParams, method)=>{
  const _method = (bolt.annotation.has(method, "controllerMethod") ?
      bolt.annotation.get(method, "controllerMethod") :
      method
  );

  return params.map(param=>{
    if (injectors.hasOwnProperty(param)) return injectors[param](component, extraParams, _method);
    if (component.req.app.dbs.hasOwnProperty(param)) return component.req.app.dbs[param];
  });
};