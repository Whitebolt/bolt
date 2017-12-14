'use strict';
// @annotation browser-export

/**
 * @module bolt/bolt
 */


/**
 * Convert a text value to a boolean if it is in the list of matched values or return the original value.
 *
 * @public
 * @param {*} value                                                   Value to convert.
 * @param {Array} defaultTrueValues=bolt.getDefault('bool.true')]     Default true values.
 * @param {Array} defaultFalseValues=bolt.getDefault('bool.false')]   Default false values.
 * @returns {boolean|*}   Boolean value or original value.
 */
function toBool(value, defaultTrueValues=['true', 'yes', 'on'], defaultFalseValues=['false', 'no', 'off']) {
  if (bolt.indexOfEquiv(defaultFalseValues, value) !== -1) {
    return false;
  } else if (bolt.indexOfEquiv(defaultTrueValues, value) !== -1) {
    return true;
  }
  return value;
}

module.exports = {
  toBool
};