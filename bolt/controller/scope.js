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
 * @param {Object} controller    Controller to get keys for.
 * @returns {Array}              The controller keys.
 */
function ownKeys(controller) {
  let casscade = _getControllerCascade(controller);
  let keys = new Set();
  casscade.forEach(controller=>Object.keys(controller=>keys.add(key)));
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
 * Proxy getOwnPropertyDescriptor() method.
 *
 * @returns {Object}     Property descriptor.
 */
function getOwnPropertyDescriptor(controller, name) {
  Object.getOwnPropertyDescriptor(get(controller, name));
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
 * Proxy apply() method.  Always throws.
 *
 * @throws SyntaxError
 */
function apply() {
  throw new SyntaxError('Cannot run controller as if it is a function.')
}

/**
 * Create a scope for given controllers.  Controllers may be derived from a series of controllers derived from different
 * root directories.  This ensures that 'this' in the controller methods roots through to all loaded methods.
 *
 * @param {Object} controller     Controller to create scope for.
 * @returns {Proxy}
 */
function createControllerScope(controller) {
  let component = bolt.annotation(controller, 'parent');
  let name = bolt.annotation(controller, 'name');

  return new Proxy(component.controllers[name], {
    apply,
    defineProperty,
    deleteProperty,
    get,
    getOwnPropertyDescriptor,
    getPrototypeOf,
    has,
    isExtensible,
    ownKeys,
    preventExtensions,
    set,
    setPrototypeOf
  });
}

module.exports = createControllerScope;