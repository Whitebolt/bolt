'use strict';

const tests = {
  methods: (value, component)=>{
    let httpMethod = (component && component.req && component.req.method) ? component.req.method.trim().toLowerCase() : '';
    if (!value.has(httpMethod)) return false;
    return true;
  },
  authenticated: (value, component)=>{
    if (component && component.req && component && component.req.isAuthenticated) return component.req.isAuthenticated();
    return false;
  },
  unauthenticated: (value, component)=>{
    if (component && component.req && component && component.req.isAuthenticated) return !component.req.isAuthenticated();
    return true;
  },
  'accepted-fields': (value, component)=>{
    if (!(component && component.req)) return false;
    let bodyFields = bolt.without(Object.keys(component.req.body || {}), ...Array.from(value));
    return (bodyFields.length === 0);
  },
  'required-fields': (value, component)=>{
    if (!(component && component.req)) return false;
    let bodyFields = bolt.without(Array.from(value), ...Object.keys(component.req.body || {}));
    return (bodyFields.length === 0);
  },
  'accepts-content': (value, component)=>{
    if (!(component && component.req)) return false;
    return !value.find(test=>component.req.is(test));
  },
  'accept-errors': (value, component)=> {
    if (!(component && component.res)) return true;
    if (component.res.statusCode >= 400) return !!value;
    return true;
  },
  'accepts-connect': (value, component)=>{
    if (!(component && component.req)) return false;
    let type = 'get';
    if (component.req.xhr) {
      type = 'xhr';
    } else if (component.req.isWebSocket) {
      type = 'websocket';
    }
    return ![...value.values()].find(test=>(test === type));
  },
  'schema': (value, component)=>{
    if (!(component && component.req && component.req.app && component.req.body && component.req.app.schemas)) return false;
    if (!component.req.app.schemas.hasOwnProperty(value)) return false;
    return !bolt.Joi.validate(component.req.body, component.req.app.schemas[value]).error;
  }
};

function testControllerAnnotationSecurity(method, component) {
  return !bolt.annotation.find(method, (value, key)=>{
    if (tests.hasOwnProperty(key)) {
      return !tests[key](bolt.annotation.get(method, key), component);
    }
  });
}

module.exports = testControllerAnnotationSecurity;