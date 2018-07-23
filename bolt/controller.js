'use strict';
// @annotation zone server

/**
 * @module bolt/bolt
 */

const _setRouteVisibilities = new Set(['public', 'viewOnly', 'protected']);
const _importOptions = {
	dirName: 'controllers',
	eventName: 'loadedController',
	importOptions: {
		extensions:['.js']
	}
};

const createControllerScope = require('./controller/scope');
const testControllerAnnotationSecurity = require('./controller/securityTests');


function injector(params, component, extraParams, method) {
	const [controllerMethod, injectors, dbs] = [
		bolt.annotation.get(method, "controllerMethod", method),
		bolt.get(component, 'req.app.injectors', {}),
		bolt.get(component, 'req.app.dbs', {})
	];

	return params.map(param=>{
		if (injectors.hasOwnProperty(param)) return injectors[param](component, extraParams, controllerMethod);
		if (dbs.hasOwnProperty(param)) return dbs[param];
	});
}

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
function _addAnnotationsToControllerMethods({component, sourceMethod, methodPath}) {
	bolt.annotation.setFrom(sourceMethod,  {
		'componentName': component.name,
		'componentPath': component.path,
		'accept-errors': false,
		methodPath
	});
	bolt.annotation.from(sourceMethod);
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
function _getControllerMethod({sourceMethod, controller}) {
	if (bolt.annotation.has(sourceMethod, 'controllerMethod')) return bolt.annotation.get(sourceMethod, 'controllerMethod');

	const params = bolt.parseParameters(sourceMethod);
	const controllerMethod = (component, ...extraParams)=>{
		if (!testControllerAnnotationSecurity(sourceMethod, component)) return component;
		bolt.emit('firingControllerMethod', bolt.annotation.get(sourceMethod, 'methodPath'), bolt.getPathFromRequest(component.req));
		return sourceMethod.apply(
			createControllerScope(controller, component, extraParams),
			injector(params, component, extraParams, sourceMethod)
		);
	};

	bolt.annotation.link(sourceMethod, controllerMethod);
	bolt.annotation.setFrom(sourceMethod, {controllerMethod, sourceMethod});


	return controllerMethod;
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
function _setControllerRoutes({methodPath, app, method, name}) {
	if (_setRouteVisibilities.has(bolt.annotation.get(method, 'visibility', 'public'))) {
		_getMethodPaths(methodPath).forEach((methodPath, priority) => {
			const _methodPath = methodPath.length?methodPath:'/';
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
	const app = bolt.getApp(component);
	bolt.addDefaultObjects(app, "controllerRoutes");
	_setComponentAndControllerAnnotations(component, controller, controllerName);

	bolt.forOwn(controller, (sourceMethod, name)=>{
		const methodPath = `${component.path}/${controllerName}/${name}`;
		const method = _getControllerMethod({sourceMethod, controller});
		_addAnnotationsToControllerMethods({component, methodPath, sourceMethod});
		_setControllerRoutes({methodPath, app, name, method});
	});

	return app.controllerRoutes;
}

/**
 * Add annotations to controllers and components to allow linking between them and referencing of different
 * cascading controllers.
 *
 * @param {BoltComponent} parent    The component to annotate.
 * @param {Object} controller       The controller to annotate.
 * @param {string} name         	The controller name.
 */
function _setComponentAndControllerAnnotations(parent, controller, name) {
	bolt.annotation.setFrom(controller, {parent, name});
	const componentControllers = bolt.annotation.get(parent, 'controllers', new Map());
	if (!componentControllers.has(name)) componentControllers.set(name, new Set());
	componentControllers.get(name).add(controller);
}

/**
 * Set annotations on controllers
 *
 * @private
 * @param {BoltApplication|BoltComponent} app     Application or component to set controller anotations on.
 */
function _setAnnotations(app) {
	bolt.forOwn(bolt.get(app, 'components', {}), parent=>{
		bolt.forOwn(bolt.get(parent, 'controllers', {}), (controller, name)=>{
			bolt.annotation.setFrom(controller, {name, parent});
			_setAnnotations(parent);
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
		bolt.forOwn(bolt.get(app, 'controllerRoutes', []), (methods, route, controllerRoutes)=>{
			controllerRoutes[route] = controllerRoutes[route].sort(bolt.prioritySorter);
		});

		// @todo Removed deep freeze as it was blocking cool stuff with proxy - need fix.
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
	return bolt.forEachOwn(controllers, (controller, name)=>_assignControllerRoutes(component, controller, name));
}

/**
 * Set file paths as annotations on controller methods for later reference.
 *
 * @private
 * @param {string} filePath      The full file path.
 * @param {object} controllers   The controllers to set method file paths on.
 */
function _setControllerMethodFilePathAnnotation(filePath, controllers) {
	return bolt.forOwnOwn(controllers, controller=>bolt.annotation.set(controller, 'filePath', filePath));
}

/**
 * Controllers load function.  Load controllers from given root(s) folder into
 * the given import object.  Generate any associated roots and connect these to
 * the application.
 *
 * @private
 * @param {BoltComponent} component       Component object to import into.
 * @param {string|Array.<string>} roots   Root folder(s) to search for controllers.
 * @param {Object} controllers            Object to import into.
 * @returns {Promise.<BoltComponent>}     Promise resolving to the supplied component.
 */
async function _loadControllers(component, roots, controllers) {
	bolt.on('loadedController', filePath=>_setControllerMethodFilePathAnnotation(filePath, controllers));

	_addControllerRoutes(component, await bolt.importIntoObject({..._importOptions, roots, importObj:controllers}));
	_addControllerRoutesToApplication();

	return controllers;
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
	return Promise.resolve(component);
}

module.exports = {
	loadControllers
};