'use strict';

/**
 * @module bolt/bolt
 */

const {Memory} = require('@simpo/map-watch');

const _memory = new Memory();
const xStackFindProxy = /[\S\s]+ Proxy\.([^\s]+) \((.*?)\:/;
const errorFactory = new bolt.ErrorFactory('controllerContext');


/**
 * Get the controller cascade for a given controller.
 *
 * @private
 * @param {Object} controller             A controller object.
 * @param {boolean} [returnArray=false]   Return an array? Defaults to false.
 * @returns {Set|Array}                   The cascade as a Set object unless an array requested.
 */
function _getControllerCascade(controller, returnArray=false) {
	let cascade;
	if (_memory.has(controller, 'cascade')) {
		cascade = _memory.get(controller, 'cascade')
	} else {
		let component = bolt.annotation.get(controller, 'parent');
		cascade = _getNamedControllerCascade(component, bolt.annotation.get(controller, 'name'));
		_memory.set(controller, 'cascade', cascade);
	}
	return ((returnArray===true) ? Array.from(cascade) : cascade);
}

/**
 * Get a named controller cascade in the given component.
 *
 * @private
 * @param {BoltComponent} component     The component to get from.
 * @param {string} name                 The name of the controller cascade to get.
 * @returns {Set}                       The controller cascade.
 */
function _getNamedControllerCascade(component, name) {
	return bolt.annotation.get(component, "controllers", name);
}


function get(component, extraParams) {

	function getBoundProperty(sourceMethod) {
		let method = bolt.annotation.get(sourceMethod, 'controllerMethod');
		return (method ? method.bind({}, component, ...extraParams) : sourceMethod);
	}

	/**
	 * Proxy get() method for controller..
	 *
	 * @throws ReferenceError
	 *
	 * @param {Object} controller     Controller to get on.
	 * @param {string} name           The property to get.
	 * @returns {*}                   The property value.
	 */
	return (controller, name)=>{
		if (name === '$parent') return createComponentScope(controller);
		if (name === '$me') {
			let callee = xStackFindProxy.exec((new Error).stack);
			let cascade = _getControllerCascade(controller, true)
				.map(controller=>controller[callee[1]])
				.filter(method=>method);
			if (cascade.find(method=>(bolt.annotation.get(method, 'filePath') === callee[2]))) return new Set(cascade);
		}
		if (controller.hasOwnProperty(name)) return getBoundProperty(controller[name]);
		let found = _getControllerCascade(controller, true).find(controller=>controller.hasOwnProperty(name));
		if (found) {
			let visibility = bolt.annotation.get(bolt.annotation.get(found[name], 'controllerMethod'), 'visibility') || 'public';
			if ((visibility === 'public') || (visibility === 'private') || (visibility === 'protected')) return getBoundProperty(found[name]);
		}
		if (!bolt.isSymbol(name) && (name !== "inspect")) throw errorFactory.error('noProperty', {name});
	};
}

/**
 * Proxy has() method for controller.
 *
 * @param {Object} controller     Controller to do has() check on.
 * @param {string} name           The property to check.
 * @returns {boolean}             Does the controller have the given property/method?
 */
function has(controller, name) {
	let found = _getControllerCascade(controller, true).find(controller=>controller.hasOwnProperty(name));
	return (found || controller.hasOwnProperty(name));
}

/**
 * Proxy set() method for controller.  Will throw an error as no setting allowed.
 *
 * @throws RangeError
 */
function set() {
	throw errorFactory.error('afterInitProperty', {});
}

/**
 * Proxy set() method for component.  Will throw an error as no setting allowed.
 *
 * @throws RangeError
 */
function setComponent() {
	throw errorFactory.error('afterInitController', {});
}

/**
 * Proxy ownKeys() for method for controller.
 *
 * @param {Object} controller    Controller to get keys for.
 * @returns {Array}              The controller keys.
 */
function ownKeys(controller) {
	let casscade = _getControllerCascade(controller);
	let keys = new Set();
	casscade.forEach(controller=>Object.keys(controller=>keys.add(key)));
	Object.keys(controller).forEach(key=>keys.add(key));
	return Array.from(keys);
}

/**
 * Proxy setPrototypeOf() method.  This blocks setting of the prototype.
 *
 * @returns {boolean}     Returns false.
 */
function setPrototypeOf() {
	return false;
}

/**
 * Proxy isExtensible() method.  Always returns false.
 *
 * @returns {boolean}     Returns false.
 */
function isExtensible() {
	return false;
}

/**
 * Proxy preventExtensions() method.  Always returns true.
 *
 * @returns {boolean}     Returns true.
 */
function preventExtensions() {
	return true;
}

/**
 * Proxy getOwnPropertyDescriptor() method for controller.
 *
 * @param {Object} controller   The controller to get for.
 * @param {string} name         The controller method/property to get for.
 * @returns {Object}            Property descriptor.
 */
function getOwnPropertyDescriptor(controller, name) {
	return Object.getOwnPropertyDescriptor(controller, name);
}

/**
 * Proxy defineProperty() method.  Always returns false.
 *
 * @returns {boolean}     Returns false.
 */
function defineProperty() {
	return false;
}

/**
 * Proxy deleteProperty() method.  Always returns false.
 *
 * @returns {boolean}     Returns false.
 */
function deleteProperty() {
	return false;
}

/**
 * Proxy getPrototypeOf() method.  Always returns the prototype of Object.
 *
 * @returns {Object}     Returns Object.prototype.
 */
function getPrototypeOf() {
	return Object.prototype;
}

/**
 * Proxy apply() method for controller.  Always throws.
 *
 * @throws SyntaxError
 */
function apply() {
	throw errorFactory.error('ccontrollerAsFunction', {});
}

/**
 * Proxy apply() method for component.  Always throws.
 *
 * @throws SyntaxError
 */
function applyComponent() {
	throw errorFactory.error('componentrAsFunction', {});
}

/**
 * Proxy get() method for component.
 *
 * @throws ReferenceError
 *
 * @param {Object} controllers      The controllers of given component.
 * @param {string} name             The controller to get.
 * @returns {Proxy}                 The controller scope to get.
 */
function componentGet(controllers, name) {
	if (name === '$parent') {
		let controllerNames = ownKeysComponent(controllers);
		if (controllerNames.length) {
			let parent = bolt.annotation.get(get(controllers, controllerNames[0]), 'parent');
			if (component.parent) return createComponentScope(parent);
		}
	} else {
		if (controllers.hasOwnProperty(name)) return createControllerScope(controllers[name]);
		if (!bolt.isSymbol(name) && (name !== "inspect")) throw errorFactory.error('noController', {name});
	}
}

/**
 * Proxy getOwnPropertyDescriptor() method  for component.
 *
 * @param {Object} controllers    Controllers object.
 * @param {string} name           The controller name to check.
 * @returns {Object}              Property descriptor.
 */
function getOwnPropertyDescriptorComponent(controllers, name) {
	return Object.getOwnPropertyDescriptor(controllers, name);
}

/**
 * Proxy has() method for component.
 *
 * @param {Object} controllers    Controllers object.
 * @param {string} name           The controller name to check.
 * @returns {boolean}             Does the component have the given controller?
 */
function hasComponent(controllers, name) {
	return controllers.hasOwnProperty(name);
}

/**
 * Proxy ownKeys() for method for component.
 *
 * @param {Object} controllers   Controllers object to get keys on.
 * @returns {Array}              The controller names.
 */
function ownKeysComponent(controllers) {
	return Object.keys(controllers);
}

/**
 * Create a scope for given component.  This is just in the controller scope.$parent.
 *
 * @param {Object|BoltComponent} controller     Controller to create a $parent for (or the actual component).
 * @returns {Proxy}
 */
function createComponentScope(controller) {
	let component = ((controller instanceof bolt.BoltComponent) ? controller : bolt.annotation.get(controller, 'parent'));

	if (_memory.has(component.controllers, 'componentScope')) return _memory.get(component.controllers, 'componentScope');
	let scope = new Proxy(component.controllers, {
		apply: applyComponent,
		defineProperty,
		deleteProperty,
		get: componentGet,
		getOwnPropertyDescriptor: getOwnPropertyDescriptorComponent,
		getPrototypeOf,
		has: hasComponent,
		isExtensible,
		ownKeys: ownKeysComponent,
		preventExtensions,
		set: setComponent,
		setPrototypeOf
	});
	_memory.set(component.controllers, scope, 'componentScope');

	return scope;
}

/**
 * Create a scope for given controllers.  Controllers may be derived from a series of controllers derived from different
 * root directories.  This ensures that 'this' in the controller methods roots through to all loaded methods.
 *
 * @param {Object} controller     Controller to create scope for.
 * @returns {Proxy}
 */
function createControllerScope(controller, router, extraParams) {
	let component = bolt.annotation.get(controller, 'parent');
	let name = bolt.annotation.get(controller, 'name');

	if (_memory.has(component.controllers[name], 'controllerScope')) return _memory.get(component.controllers[name], 'controllerScope');
	let scope = new Proxy(component.controllers[name], {
		apply,
		defineProperty,
		deleteProperty,
		get: get(router, extraParams),
		getOwnPropertyDescriptor,
		getPrototypeOf,
		has,
		isExtensible,
		ownKeys,
		preventExtensions,
		set,
		setPrototypeOf
	});
	_memory.set(component.controllers[name], scope, 'controllerScope');

	return scope;
}

module.exports = createControllerScope;