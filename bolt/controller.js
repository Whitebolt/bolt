'use strict';

/**
 * @module bolt/bolt
 */

const createControllerScope = require('./controller/scope');


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
  doc: component=>(component.req.doc || {}),
  done: component=>{
    return (value=true)=>{component.done = !!value}
  },
  app: component=>component.req.app,
  path: component=>bolt.getPathFromRequest(component.req),
  db: component=>component.req.app.db,
  view: component=>component.view,
  config: component=>component.req.app.config
});

/**
 * Object of methods to map parse specfic annotations.  Some annotations may have bespoke structure; here we set methods
 * to parse these.
 *
 * @type {Object}
 */
const annotationParser = Object.freeze({
  methods: annotations=>annotations.set('methods', new Set(annotations
    .get('methods')
    .toLowerCase()
    .split(',')
    .map(method=>method.trim())
    .filter(method=>(method.trim() !== '')))
  )
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
 * @returns {Map}                                 The annotations map for given method.
 */
function _addAnnotationsToControllerMethods(config) {
  let {component, method, sourceMethod, methodPath} = config;

  let annotations = bolt.annotationsFromSource(sourceMethod, method);

  bolt.annotation(method,  {
    componentName: component.name,
    componentPath: component.path,
    methodPath
  });

  annotations.forEach((value, annotation)=>{
    if (annotationParser.hasOwnProperty(annotation)) annotationParser[annotation](annotations);
  });

  return annotations;
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
  if (bolt.annotation(sourceMethod, 'controllerMethod')) return bolt.annotation(sourceMethod, 'controllerMethod');

  let params = bolt.parseParameters(sourceMethod);
  let method = component=>{
    let methods = bolt.annotation(method, 'methods');
    if (methods) {
      let httpMethod = (component && component.req && component.req.method) ? component.req.method.trim().toLowerCase(): '';
      if (!methods.has(httpMethod)) return component;
    }

    return sourceMethod.apply(createControllerScope(controller), params.map(param=>{
      if (injectors.hasOwnProperty(param)) return injectors[param](component);
      if (component.req.app.dbs.hasOwnProperty(param)) return component.req.app.dbs[param];
    }));
  };

  bolt.annotation(sourceMethod, 'controllerMethod', method);
  bolt.annotation(method, 'sourceMethod', sourceMethod);

  return method;
}

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
      if (bolt.annotation(method, 'methodPath') === bolt.annotation(route.method, 'methodPath')) route.priority2++;
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
  bolt.annotation(controller, 'parent', component);
  bolt.annotation(controller, 'name', controllerName);
  let componentAnnotations = bolt.annotation(component);
  if (!componentAnnotations.has('controllers')) componentAnnotations.set('controllers', new Map());
  let componentControllers = componentAnnotations.get('controllers');
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
      bolt.annotation(app.components[componentName].controllers[controllerName], 'parent', app.components[componentName]);
      bolt.annotation(app.components[componentName].controllers[controllerName], 'name', controllerName);
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
      let _filePath = bolt.annotation(controller[controllerName][methodName], 'filePath');
      if (!_filePath) bolt.annotation(controller[controllerName][methodName], 'filePath', filePath);
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