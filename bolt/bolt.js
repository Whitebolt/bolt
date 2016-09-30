'use strict';

/**
 * @module bolt/bolt
 */

const defaults = new Map();
const watchers = new Map();

/**
 * Generate a random string of specified length.
 *
 * @todo    Use some sort of generic algorithm instead of this one (perhaps a stock node module).
 * @todo    Add more options such as hex string.
 *
 * @public
 * @param {integer} [length=32] The length of string to return.
 * @returns {string}            The random string.
 */
function _randomString(length=32) {
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'.split('');

  if (!length) length = Math.floor(Math.random() * chars.length);

  var str = '';
  for (var i = 0; i < length; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
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
  defaults.set(key, value);
  return _fireWatchers(key, value);
}

/**
 * Get global default in the bolt object for specified key name.
 *
 * @public
 * @param {string} key  The default to get.
 * @returns {*}         The default value.
 */
function getDefault(key) {
  return defaults.get(key);
}

/**
 * Fire a specific watcher, firing any registered callbacks for that default.
 *
 * @private
 * @param {string} key    The key to fire watchers for.
 * @param {*} value       The new value for that key.
 * @returns {*}           The new value for that key.
 */
function _fireWatchers(key, value=defaults.get(key)) {
  if (watchers.has(key)) {
    watchers.get(key).forEach(_callback=>_callback.callback(value));
  }
  return value;
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
  if (!watchers.has(key)) watchers.set(key, []);
  let _watcers = watchers.get(key);
  let id = _randomString();
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
  setDefault, getDefault, watchDefault
};