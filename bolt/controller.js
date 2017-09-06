'use strict';

/**
 * @module bolt/bolt
 */

const createControllerScope = require('./controller/scope');
const {AdvancedSet} = require('map-watch');
const xSpaceOrComma = /,| /;


/**
 * @module bolt/bolt
 */

/**
 * Get all possible routes to given method in priority order.
 *
 * @private
 * @param {string} methodPath   The main direct route.
 * @returns {Array.<string>}    Array of possible paths.
 */
function _getMethodPaths(methodPath) {
  let methodPaths = [methodPath];
  let cLength = methodPath.length;
  let cPath = bolt.replaceLast(methodPath, '/index', '');
  while (cPath.length !== cLength) {
    methodPaths.push(cPath);
    cLength = cPath.length;
    cPath = bolt.replaceLast(cPath, '/index', '');
  }
  return methodPaths;
}

/**
 * Object of methods to map dynamic inclusion parameters in controllers to what should be actually supplied to the
 * controller method.
 *
 * @type {Object}
 */
const injectors = Object.freeze({
  req: component=>component.req,
  res: component=>component.res,
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
  }
});

/**
 * Set annotations on given method by using default values and extracting from the method source.
 *
 * @private
 * @param {Object} config                         Config object.
 * @param {BoltComponent} config.component        The component parent of  this controller method.
 * @param {Function} config.method                The method to be invoked in routes.
 * @param {Function|string} config.sourceMethod   The original source method from which, method is derived.
 *                                                Can be method source.
 * @param {string} config.methodPath              The path to the method in the app.
 */
function _addAnnotationsToControllerMethods(config) {
  let {component, method, sourceMethod, methodPath} = config;

  bolt.annotation.set(method, 'accept-errors', false);
  bolt.annotation.from(sourceMethod, method);

  bolt.annotation.setFrom(method,  {
    componentName: component.name,
    componentPath: component.path,
    methodPath
  });
}

/**
 * Create the method, which is invoked for given controller method.
 *
 * @private
 * @param {Object} config                         Config object.
 * @param {Function} config.sourceMethod          The original source method from which, method is derived.
 * @param {Object} config.controller              The parent controller.
 * @returns {Function}                            The method to fire for given controller method.
 */
function _getControllerMethod(config) {
  let {sourceMethod, controller} = config;
  if (bolt.annotation.has(sourceMethod, 'controllerMethod')) return bolt.annotation.get(sourceMethod, 'controllerMethod');

  let params = bolt.parseParameters(sourceMethod);
  let method = (component, ...extraParams)=>{
    if (!_testControllerAnnotationSecurity(method, component)) return component;
    bolt.fire('firingControllerMethod', bolt.annotation.get(method, 'methodPath'), bolt.getPathFromRequest(component.req));
    return sourceMethod.apply(createControllerScope(controller, component, extraParams), params.map(param=>{
      if (injectors.hasOwnProperty(param)) return injectors[param](component, extraParams);
      if (component.req.app.dbs.hasOwnProperty(param)) return component.req.app.dbs[param];
    }));
  };

  bolt.annotation.set(sourceMethod, 'controllerMethod', method);
  bolt.annotation.set(method, 'sourceMethod', sourceMethod);

  return method;
}

function _testControllerAnnotationSecurity(method, component) {
  return !bolt.annotation.find(method, (value, key)=>{
    if (_controllerAnnotationTests.hasOwnProperty(key)) {
      return !_controllerAnnotationTests[key](bolt.annotation.get(method, key), component);
    }
  });
}

const _controllerAnnotationTests = {
  methods: (value, component)=>{
    let httpMethod = (component && component.req && component.req.method) ? component.req.method.trim().toLowerCase() : '';
    if (!value.has(httpMethod)) return false;
    return true;
  },
  authenticated: (value, component)=>{
    if (component && component.req && component && component.req.isAuthenticated) return component.req.isAuthenticated();
    return false;
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
    return !value.find(test=>(test === type));
  },
  'schema': (value, component)=>{
    if (!(component && component.req && component.req.app && component.req.body && component.req.app.schemas)) return false;
    if (!component.req.app.schemas.hasOwnProperty(value)) return false;
    return !bolt.Joi.validate(component.req.body, component.req.app.schemas[value]).error;
  }
};

function _parseAnnotationSet(value, lowecase=false) {
  let _value = (lowecase?value.toLocaleString():value);
  return new AdvancedSet(
    _value.split(xSpaceOrComma).map(value=>value.trim()).filter(value=>(value.trim() !== ''))
  );
}

const _annotationParsers = [
  value=>{
    // @annotation key methods
    return _parseAnnotationSet(value, true);
  },
  ()=>{
    // @annotation key authenticated
    return true;
  },
  value=>{
    // @annotation key accepted-fields
    return _parseAnnotationSet(value);
  },
  value=>{
    // @annotation key accept-errors
    return bolt.toBool(value);
  },
  value=>{
    // @annotation key required-fields
    return _parseAnnotationSet(value);
  },
  value=>{
    // @annotation key accepts-content
    return _parseAnnotationSet(value);
  },
  value=>{
    // @annotation key accepts-connect
    return _parseAnnotationSet(value);
  }
];

_annotationParsers.forEach(parser=>bolt.annotation.addParser(parser));


/**
 * Set the controller routes for the given method.
 *
 * @private
 * @param {Object} config                  Config object.
 * @param {Function} config.method         The method to be invoked in routes.
 * @param {BoltApplication} config.app     The application object.
 * @param {string} config.name             The method name.
 * @param {string} config.methodPath       The path to the method in the app.
 */
function _setControllerRoutes(config) {
  let {methodPath, app, method, name} = config;

  _getMethodPaths(methodPath).forEach((methodPath, priority) => {
    let _methodPath = methodPath.length?methodPath:'/';
    bolt.addDefaultObjects(app.controllerRoutes, _methodPath, true);

    app.controllerRoutes[_methodPath].forEach(route=>{
      if (bolt.annotation.get(method, 'methodPath') === bolt.annotation.get(route.method, 'methodPath')) route.priority2++;
    });

    app.controllerRoutes[_methodPath].push({method, name, priority, priority2:0});
  });
}

/**
 * Calculate all possible routes for a given controller and then assign these
 * with correct priority to the application controller routes.
 *
 * @private
 * @param {BoltComponent} component     The component object.
 * @param {Object} controller           The controller object we are working on.
 * @param {string} controllerName       The name of the controller.
 * @returns {Object}                    All controller routes for application.
 */
function _assignControllerRoutes(component, controller, controllerName) {
  let app = bolt.getApp(component);
  bolt.addDefaultObjects(app, "controllerRoutes");
  _setComponentAndControllerAnnotations(component, controller, controllerName);

  Object.keys(controller).forEach(name=>{
    let sourceMethod = controller[name];
    let methodPath = component.path + '/' + controllerName + '/' + name;
    let method = _getControllerMethod({sourceMethod, controller});
    _addAnnotationsToControllerMethods({component, methodPath, method, sourceMethod});
    _setControllerRoutes({methodPath, app, name, method});
  });

  return app.controllerRoutes;
}

/**
 * Add annotations to controllers and components to allow linking between them and referencing of different
 * cascading controllers.
 *
 * @param {BoltComponent} component       The component to annotate.
 * @param {Object} controller             The controller to annotate.
 * @param {string} controllerName         The controller name.
 */
function _setComponentAndControllerAnnotations(component, controller, controllerName) {
  bolt.annotation.setFrom(controller, {
    parent: component,
    name: controllerName
  });
  if (!bolt.annotation.get(component, 'controllers')) bolt.annotation.set(component, 'controllers', new Map());
  let componentControllers = bolt.annotation.get(component, 'controllers');
  if (!componentControllers.has(controllerName)) componentControllers.set(controllerName, new Set());
  componentControllers.get(controllerName).add(controller);
}

/**
 * Deep freeze controller methods and properties.
 *
 * @private
 * @param {BoltApplication|BoltComponent} app     Application or component to freeze controllers on.
 */
function _freezeControllers(app) {
  Object.keys(app.components || {}).forEach(componentName=>{
    Object.keys(app.components[componentName].controllers).forEach(controllerName=>{
      bolt.deepFreeze(app.components[componentName].controllers[controllerName]);
      _freezeControllers(app.components[componentName]);
    });
  });
}

/**
 * Set annotations on controllers
 *
 * @private
 * @param {BoltApplication|BoltComponent} app     Application or component to set controller anotations on.
 */
function _setAnnotations(app) {
  Object.keys(app.components || {}).forEach(componentName=>{
    Object.keys(app.components[componentName].controllers).forEach(controllerName=>{
      bolt.annotation.set(app.components[componentName].controllers[controllerName], 'parent', app.components[componentName]);
      bolt.annotation.set(app.components[componentName].controllers[controllerName], 'name', controllerName);
      _setAnnotations(app.components[componentName]);
    });
  });
}

/**
 * Setup event callback to add routes to controller just before the app is run.
 *
 * @private
 * @returns {boolean}   Always returns to true to ensure proper running of
 *                      promise chains.
 */
function  _addControllerRoutesToApplication() {
  bolt.once('beforeRunApp', (options, app)=>{
    Object.keys(app.controllerRoutes).forEach(route=>{
      app.controllerRoutes[route] = app.controllerRoutes[route].sort(bolt.prioritySorter);
    });
    _freezeControllers(app);
    _setAnnotations(app);
  }, {id:'addControllerRoutesToApplication'});

  return true;
}

/**
 * Cycle through each controller and controller method generating associated routes.
 *
 * @private
 * @param {BoltComponent} component    Parent component for given controllers.
 * @param {Array} controllers         Array of controllers.
 * @returns {Array}                   The controller array as given in parameters.
 */
function _addControllerRoutes(component, controllers) {
  controllers.forEach(
    controller=>{
      return Object.keys(controller).forEach( controllerName=>{
        _assignControllerRoutes(component, controller[controllerName], controllerName);
      })
    }
  );

  return controllers;
}

/**
 * Set file paths as annotations on controller methods for later reference.
 *
 * @private
 * @param {string} filePath     The full file path.
 * @param {object} controller   The controller to set method file paths on.
 */
function _setControllerMethodFilePathAnnotation(filePath, controller) {
  Object.keys(controller).forEach(controllerName=>{
    Object.keys(controller[controllerName]).forEach(methodName=>{
      let _filePath = bolt.annotation.get(controller[controllerName][methodName], 'filePath') || filePath;
    });
  })
}

/**
 * Controllers load function.  Load controllers from given root(s) folder into
 * the given import object.  Generate any associated roots and connect these to
 * the application.
 *
 * @private
 * @param {BoltComponent} component       Component object to import into.
 * @param {string|Array.<string>} roots   Root folder(s) to search for controllers.
 * @param {Object} importObject           Object to import into.
 * @returns {Promise.<BoltComponent>}     Promise resolving to the supplied component.
 */
function _loadControllers(component, roots, importObj) {
  bolt.hook('loadedController', (undefined, filePath)=>_setControllerMethodFilePathAnnotation(filePath, importObj));

  return bolt
    .importIntoObject({roots, importObj, dirName:'controllers', eventName:'loadedController'})
    .then(controllers=>_addControllerRoutes(component, controllers))
    .then(_addControllerRoutesToApplication)
    .then(()=>importObj);
}

/**
 * Search given folders for controllers and import into given component object,
 * running an necessary setup.
 *
 * @param {BoltComponent} component                     Component object to import into.
 * @param {string|Array.<string>} roots                 Root folder(s) to search for controllers.
 * @param {Object} [controllers=component.controllers]  Object to import into.
 * @returns {Promise.<BoltComponent>}                   Promise resolving to the supplied component.
 */
function loadControllers(component, roots, controllers=component.controllers) {
  return bolt.fire(
    ()=>_loadControllers(component, roots, controllers), 'loadControllers', component
  ).then(()=>component);
}

module.exports = {
	loadControllers
};