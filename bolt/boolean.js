'use strict';

/**
 * @module bolt/bolt
 */

const _bolt = require('./bolt');

let _defaultTrueValues = _bolt.setDefault('bool.true', ['true', 'yes', 'on']);
_bolt.watchDefault('bool.true', value=>{_defaultTrueValues = value;});
let _defaultFalseValues = _bolt.setDefault('bool.false', ['false', 'no', 'off']);
_bolt.watchDefault('bool.false', value=>{_defaultFalseValues = value;});


/**
 * Convert a text value to a boolean if it is in the list of matched values
 * or return the original value.
 *
 * @public
 * @param {*} value                                                   Value to
 *                                                                    convert.
 * @param {Array} defaultTrueValues=bolt.getDefault('bool.true')]     Default
 *                                                                    true
 *                                                                    values.
 * @param {Array} defaultFalseValues=bolt.getDefault('bool.false')]   Default
 *                                                                    false
 *                                                                    values.
 * @returns {boolean|*}   Boolean value or original value.
 */
function toBool(value, defaultTrueValues=_defaultTrueValues, defaultFalseValues=_defaultFalseValues) {
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