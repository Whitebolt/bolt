'use strict';

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

const injectors = {
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
};



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

  Object.keys(controller).forEach(name=>{
    let methodPath = component.path + '/' + controllerName + '/' + name;

    let params = bolt.parseParameters(controller[name]);

    let method = component=>controller[name].apply(
      controller,
      params.map(param=>(injectors.hasOwnProperty(param) ? injectors[param](component) : undefined))
    );

    bolt.annotationsFromSource(controller[name], method);

    bolt.annotation(method,  {
      componentName: component.name,
      componentPath: component.path,
      methodPath: methodPath
    });

    _getMethodPaths(methodPath).forEach((methodPath, priority) => {
      let _methodPath = methodPath.length?methodPath:'/';
      bolt.addDefaultObjects(app.controllerRoutes, _methodPath, true);

      app.controllerRoutes[_methodPath].forEach(route=>{
        if (bolt.annotation(method, 'methodPath') === bolt.annotation(route.method, 'methodPath')) route.priority2++;
      });

      app.controllerRoutes[_methodPath].push({method, name, priority, priority2:0});
    });
  });

  return app.controllerRoutes;
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
    controller=>Object.keys(controller).forEach(
      controllerName=>_assignControllerRoutes(component, controller[controllerName], controllerName)
    )
  );

  return controllers;
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
  ).then(() => component);
}

module.exports = {
	loadControllers
};