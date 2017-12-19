'use strict';

/**
 * @module bolt/bolt
 *
 * @todo Extract some of this into a npm for watchable maps?
 */

const defaults = new Map();
const watchers = new Map();
const lookup = new Map();

lookup.set('defaults', defaults);
lookup.set('watchers', watchers);

/**
 * Get the map for the current app space. This stops errors from different apps accesing the same cached space.
 *
 * @private
 * @param {string} type   Either 'defaults' or 'watchers', which map to return.
 * @returns {Map}
 */
function _getMap(type) {
  try {
    let requestedMap = lookup.get(type);
    if (!requestedMap.has(boltAppID)) requestedMap.set(boltAppID, new Map());
    return requestedMap.get(boltAppID);
  } catch (err) {
    throw new ReferenceError('No app space defined for defaults, global property \'boltAppId\' should be set');
  }
}

/**
 * Set a global default value for bolt object
 *
 * @public
 * @param {string} key    The default value to set.
 * @param {*} value       The value to set the default to.
 * @returns {*}           The value he default has been set to.
 */
function setDefault(key, value) {
  let defaults = _getMap('defaults');
  _fireWatchers(key, value, defaults.has(key)?getDefault(key):undefined);
  defaults.set(key, value);
  return value;
}

/**
 * Get global default in the bolt object for specified key name.
 *
 * @public
 * @param {string} key  The default to get.
 * @returns {*}         The default value.
 */
function getDefault(key) {
  let defaults = _getMap('defaults');
  if (!defaults.has(key)) throw new ReferenceError(`Attempt to get default value: ${key}, which does not exist.`);
  return defaults.get(key);
}

/**
 * Test global default key exists.
 *
 * @public
 * @param {string} key  The default to test.
 * @returns {boolean}   Has key?
 */
function hasDefault(key) {
  return _getMap('defaults').has(key);
}

/**
 * Delete a global default.
 *
 * @public
 * @param {string} key  The default to test.
 * @returns {boolean}   Has key?
 */
function deleteDefault(key) {
  return _getMap('defaults').delete(key);
}

/**
 * Test global default has a watcher assigned.
 *
 * @public
 * @param {string} key  The default to test.
 * @returns {boolean}   Has a watcher?
 */
function hasDefaultWatcher(key) {
  return _getMap('defaults').has(key);
}

/**
 * Fire a specific watcher, firing any registered callbacks for that default.
 *
 * @private
 * @param {string} key    The key to fire watchers for.
 * @param {*} value       The new value for that key.
 * @param {*} value       The new old value for that key.
 * @returns {*}           The new value for that key.
 */
function _fireWatchers(key, value, oldValue) {
  let watchers = _getMap('watchers');
  if (watchers.has(key)) watchers.get(key).forEach(
    _callback=>_callback.callback(value, oldValue)
  );
}

/**
 * Watch a default value reporting on any changes.
 *
 * @static
 * @public
 * @param {string} key          Key to watch.
 * @param {function} callback   Callback when watched changes.
 * @returns {function}          An unwatch function, when call will unregister this watch.
 */
function watchDefault(key, callback) {
  let watchers = _getMap('watchers');
  if (!watchers.has(key)) watchers.set(key, []);
  let _watcers = watchers.get(key);
  let id = bolt.randomString();
  let _callback = {callback, id};
  _watcers.push(_callback);
  watchers.set(key, _watcers);

  return ()=>{
    if (watchers.has(key)) {
      watchers.set(
        key,
        watchers.get(key).filter(_callback=>(_callback.id !== id))
      );
    }
  };
}

module.exports = {
  setDefault, getDefault, hasDefault, deleteDefault, watchDefault, hasDefaultWatcher
};