'use strict';

/**
 * Get the controller cascade for a given controller.
 *
 * @private
 * @param {Object} controller             A controller object.
 * @param {boolean} [returnArray=false]   Return an array? Defaults to false.
 * @returns {Set|Array}                   The cascade as a Set object unless an array requested.
 */
function _getControllerCascade(controller, returnArray=false) {
  let component = bolt.annotation(controller, 'parent');
  let cascade = _getNamedControllerCascade(component, bolt.annotation(controller, 'name'));
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
  return bolt.annotation(component).get("controllers").get(name)
}

/**
 * Proxy get() function.
 *
 * @throws ReferenceError
 *
 * @param {Object} controller     Controller to get on.
 * @param {string} name           The property to get.
 * @returns {*}                   The property value.
 */
function get(controller, name) {
  if (controller.hasOwnProperty(name)) return controller[name];
  let found = _getControllerCascade(controller, true).find(controller=>controller.hasOwnProperty(name));
  if (found) return found[name];
  throw new ReferenceError(`Property/Method ${name} does not exist for given controller.`)
}

/**
 * Proxy has() method
 *
 * @param {Object} controller     Controller to do has() check on.
 * @param {string} name           The property to check.
 * @returns {boolean}             Does the controller have the given property/method?
 */
function has(controller, name) {
  return _getControllerCascade(controller, true).find(controller=>controller.hasOwnProperty(name));
}

/**
 * Proxy set() method.  Will throw an error as no setting allowed.
 *
 * @throws RangeError
 */
function set() {
  throw new RangeError('Cannot set properties or methods on controllers after initialisation');
}

/**
 * Proxy ownKeys() method
 *
 * @param {Object} controller     Controller to do has() check on.
 * @returns {Array}               The controller keys.
 */
function ownKeys(controller) {
  let casscade = _getControllerCascade(controller);
  let keys = new Set();
  casscade.forEach(controller=>Object.keys(controller=>keys.add(key)));
  return Array.from(keys);
}

/**
 * Create a scope for given controllers.  Controllers may be derived from a series of controllers derived from different
 * root directories.  This ensures that 'this' in the controller methods roots through to all loaded methods.
 *
 * @param {Object} controller     Controller to create scope for.
 * @returns {Proxy}
 */
function createControllerScope(controller) {
  return new Proxy(controller, {get, has, set, ownKeys});
}

module.exports = createControllerScope;