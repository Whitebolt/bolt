'use strict';

/**
 * @module bolt/bolt
 */

const $private = require('@simpo/private').getInstance();
const {xStackFindProxy} = bolt.consts;
const controllerContextError = (new bolt.ErrorFactory('controllerContext')).error;
const _setRouteVisibilities = new Set(['public', 'private', 'protected']);


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
	if ($private.has(controller, 'cascade')) {
		cascade = $private.get(controller, 'cascade')
	} else {
		let component = bolt.annotation.get(controller, 'parent');
		cascade = _getNamedControllerCascade(component, bolt.annotation.get(controller, 'name'));
		$private.set(controller, 'cascade', cascade);
	}
	return bolt.chain((returnArray===true) ? Array.from(cascade) : cascade);
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

class ControllerScope {
	constructor(router, extraParams) {
		function getBoundProperty(sourceMethod) {
			const method = bolt.annotation.get(sourceMethod, 'controllerMethod') || sourceMethod;
			return ()=>method(router, ...extraParams);
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
		this.get = (controller, name)=>{
			if (name === '$parent') return createComponentScope(controller);

			const _cascade = _getControllerCascade(controller, true);
			if (name === '$me') {
				let callee = xStackFindProxy.exec((new Error).stack);
				let cascade = bolt.chain(_cascade)
					.map(controller=>controller[callee[1]])
					.filter(method=>method).value();
				if (cascade.find(method=>(bolt.annotation.get(method, 'filePath').value() === callee[2]))) return new Set(cascade.value());
			}

			if (controller.hasOwnProperty(name)) return getBoundProperty(controller[name]);

			let found;
			_cascade.every(controller=>{
				const [controllerName, methods] = controller;
				found = [...methods.values()].find(controller=>controller.hasOwnProperty(name));
				return !found;
			}).value();

			if (found) {
				const visibility = bolt.annotation.get(found[name], 'visibility', 'public');
				if (_setRouteVisibilities.has(visibility)) return getBoundProperty(found[name]);
			}

			if (!bolt.isSymbol(name) && (name !== "inspect")) throw controllerContextError('NoProperty', {name});
		}
	}

	/**
	 * Proxy apply() method for controller.  Always throws.
	 *
	 * @throws SyntaxError
	 */
	apply() {
		throw controllerContextError('ControllerAsFunction', {});
	}

	/**
	 * Proxy defineProperty() method.  Always returns false.
	 *
	 * @returns {boolean}     Returns false.
	 */
	defineProperty() {
		return false;
	}


	/**
	 * Proxy deleteProperty() method.  Always returns false.
	 *
	 * @returns {boolean}     Returns false.
	 */
	deleteProperty() {
		return false;
	}

	/**
	 * Proxy getOwnPropertyDescriptor() method for controller.
	 *
	 * @param {Object} controller   The controller to get for.
	 * @param {string} name         The controller method/property to get for.
	 * @returns {Object}            Property descriptor.
	 */
	getOwnPropertyDescriptor(controller, name) {
		return Object.getOwnPropertyDescriptor(controller, name);
	}

	/**
	 * Proxy getPrototypeOf() method.  Always returns the prototype of Object.
	 *
	 * @returns {Object}     Returns Object.prototype.
	 */
	getPrototypeOf() {
		return Object.prototype;
	}

	/**
	 * Proxy has() method for controller.
	 *
	 * @param {Object} controller     Controller to do has() check on.
	 * @param {string} name           The property to check.
	 * @returns {boolean}             Does the controller have the given property/method?
	 */
	has(controller, name) {
		let found = _getControllerCascade(controller, true).find(controller=>controller.hasOwnProperty(name)).value();
		return (found || controller.hasOwnProperty(name));
	}

	/**
	 * Proxy isExtensible() method.  Always returns false.
	 *
	 * @returns {boolean}     Returns false.
	 */
	isExtensible() {
		return false;
	}

	/**
	 * Proxy ownKeys() for method for controller.
	 *
	 * @param {Object} controller    Controller to get keys for.
	 * @returns {Array}              The controller keys.
	 */
	ownKeys(controller) {
		let casscade = _getControllerCascade(controller);
		let keys = new Set();
		casscade.forEach(controller=>Object.keys(controller=>keys.add(key))).value();
		Object.keys(controller).forEach(key=>keys.add(key));
		return Array.from(keys);
	}

	/**
	 * Proxy preventExtensions() method.  Always returns true.
	 *
	 * @returns {boolean}     Returns true.
	 */
	preventExtensions() {
		return true;
	}

	/**
	 * Proxy set() method for controller.  Will throw an error as no setting allowed.
	 *
	 * @throws RangeError
	 */
	set() {
		throw controllerContextError('AfterInitProperty', {});
	}

	/**
	 * Proxy setPrototypeOf() method.  This blocks setting of the prototype.
	 *
	 * @returns {boolean}     Returns false.
	 */
	setPrototypeOf() {
		return false;
	}
}

class ComponentScope extends ControllerScope {
	/**
	 * Proxy apply() method for component.  Always throws.
	 *
	 * @throws SyntaxError
	 */
	apply() {
		throw controllerContextError('ComponentrAsFunction', {});
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
	get(controllers, name) {
		if (name === '$parent') {
			let controllerNames = ownKeysComponent(controllers);
			if (controllerNames.length) {
				let parent = bolt.annotation.get(get(controllers, controllerNames[0]), 'parent');
				if (component.parent) return createComponentScope(parent);
			}
		} else {
			if (controllers.hasOwnProperty(name)) return createControllerScope(controllers[name]);
			if (!bolt.isSymbol(name) && (name !== "inspect")) throw controllerContextError('NoController', {name});
		}
	}

	/**
	 * Proxy getOwnPropertyDescriptor() method  for component.
	 *
	 * @param {Object} controllers    Controllers object.
	 * @param {string} name           The controller name to check.
	 * @returns {Object}              Property descriptor.
	 */
	getOwnPropertyDescriptor(controllers, name) {
		return Object.getOwnPropertyDescriptor(controllers, name);
	}

	/**
	 * Proxy has() method for component.
	 *
	 * @param {Object} controllers    Controllers object.
	 * @param {string} name           The controller name to check.
	 * @returns {boolean}             Does the component have the given controller?
	 */
	has(controllers, name) {
		return controllers.hasOwnProperty(name);
	}

	/**
	 * Proxy ownKeys() for method for component.
	 *
	 * @param {Object} controllers   Controllers object to get keys on.
	 * @returns {Array}              The controller names.
	 */
	ownKeys(controllers) {
		return Object.keys(controllers);
	}

	/**
	 * Proxy set() method for component.  Will throw an error as no setting allowed.
	 *
	 * @throws RangeError
	 */
	set() {
		throw controllerContextError('AfterInitController', {});
	}
}

/**
 * Create a scope for given component.  This is just in the controller scope.$parent.
 *
 * @param {Object|BoltComponent} controller     Controller to create a $parent for (or the actual component).
 * @returns {Proxy}
 */
function createComponentScope(controller, router, extraParams) {
	const component = ((controller instanceof bolt.BoltComponent) ? controller : bolt.annotation.get(controller, 'parent'));
	const controllers = component.controllers;

	if ($private.has(controllers, 'componentScope')) return $private.get(controllers, 'componentScope');
	const scope = new Proxy(controllers, new ComponentScope(router, extraParams));
	$private.set(controllers, scope, 'componentScope');

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
	const [component, name] = bolt.annotation.get(controller, ['parent', 'name']);
	const _controller = component.controllers[name];

	if ($private.has(_controller, 'controllerScope')) return $private.get(_controller, 'controllerScope');
	const scope = new Proxy(_controller, new ControllerScope(router, extraParams));
	$private.set(_controller, scope, 'controllerScope');

	return scope;
}

module.exports = createControllerScope;