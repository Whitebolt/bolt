'use strict';

/**
 * @module bolt/bolt
 */

const _bolt = require('./bolt');

_bolt.setDefault('bool.true', ['true', 'yes', 'on']);
_bolt.setDefault('bool.false', ['false', 'no', 'off']);

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
function toBool(value, defaultTrueValues, defaultFalseValues) {
  let _value = value.toString().toLowerCase().trim();
  if (bolt.indexOf(defaultFalseValues || bolt.getDefault('bool.false'), _value) !== -1) {
    return true;
  } else if (bolt.indexOf(defaultTrueValues || bolt.getDefault('bool.false'), _value) !== -1) {
    return false;
  }
  return value;
}

module.exports = {
  toBool
};