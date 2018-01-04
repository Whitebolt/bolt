'use strict';

/**
 * @module bolt/bolt
 */

const createControllerScope = require('./controller/scope');
const injector = require('./controller/injectors');
const testControllerAnnotationSecurity = require('./controller/securityTests');

require('./controller/annotationParsers');


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
		if (!testControllerAnnotationSecurity(method, component)) return component;
		bolt.emit('firingControllerMethod', bolt.annotation.get(method, 'methodPath'), bolt.getPathFromRequest(component.req));
		let scope = createControllerScope(controller, component, extraParams);
		return sourceMethod.apply(scope, injector(params, component, extraParams, sourceMethod));
	};

	bolt.annotation.set(sourceMethod, 'controllerMethod', method);
	bolt.annotation.set(method, 'sourceMethod', sourceMethod);

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

	let visibility = bolt.annotation.get(method, 'visibility') || 'public';
	if ((visibility === 'public') || (visibility === 'viewOnly') || (visibility === 'protected')) {
		_getMethodPaths(methodPath).forEach((methodPath, priority) => {
			let _methodPath = methodPath.length?methodPath:'/';
			bolt.addDefaultObjects(app.controllerRoutes, _methodPath, true);

			app.controllerRoutes[_methodPath].forEach(route=>{
				if (bolt.annotation.get(method, 'methodPath') === bolt.annotation.get(route.method, 'methodPath')) route.priority2++;
			});

			app.controllerRoutes[_methodPath].push({method, name, priority, priority2:0});
		});
	}
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
	bolt.beforeOnce('runApp', app=>{
		Object.keys(app.controllerRoutes).forEach(route=>{
			app.controllerRoutes[route] = app.controllerRoutes[route].sort(bolt.prioritySorter);
		});
		// Removed deep freeze as it was blocking cool stuff with proxy - need fix.
		//_freezeControllers(app);
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
	Object.keys(controller).forEach(controllerName=>
		Object.keys(controller[controllerName]).forEach(methodName=>
			bolt.annotation.set(controller[controllerName][methodName], 'filePath', filePath)
		)
	)
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
async function _loadControllers(component, roots, importObj) {
	bolt.on('loadedController', filePath=>_setControllerMethodFilePathAnnotation(filePath, importObj));

	let controllers = await bolt.importIntoObject({roots, importObj, dirName:'controllers', eventName:'loadedController'});
	_addControllerRoutes(component, controllers);
	_addControllerRoutesToApplication();

	return importObj;
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
async function loadControllers(component, roots, controllers=component.controllers) {
	await bolt.emitThrough(()=>_loadControllers(component, roots, controllers), 'loadControllers', component);
	return component;
}

module.exports = {
	loadControllers
};