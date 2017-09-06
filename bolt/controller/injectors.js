'use strict';

/**
 * Object of methods to map dynamic inclusion parameters in controllers to what should be actually supplied to the
 * controller method.
 *
 * @type {Object}
 */
const injectors = Object.freeze({
  req: component=>component.req,
  res: component=>component.res || component.res,
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
  db: component=>component.req.app.db,
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
  }
});

module.exports = (params, component, extraParams)=>{
  return params.map(param=>{
    if (injectors.hasOwnProperty(param)) return injectors[param](component, extraParams);
    if (component.req.app.dbs.hasOwnProperty(param)) return component.req.app.dbs[param];
  });
};