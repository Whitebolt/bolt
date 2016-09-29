'use strict';

let defaults = new Map();

/**
 * Set a global default value for bolt object
 *
 * @public
 * @param {string} key    The default value to set.
 * @param {*} value       The value to set the default to.
 * @returns {*}           The value the default has been set to.
 */
function setDefault(key, value) {
  return defaults.set(key, value);
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

module.exports = {
  setDefault, getDefault
};