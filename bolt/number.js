'use strict';
// @annotation browser-export true

/**
 * @module bolt/bolt
 */

const xIsInt = /^[0-9]+$/;

/**
 * Test if a value is a number or can be converted to one.
 *
 * @public
 * @param {*} value     Value to test.
 * @returns {boolen}    Is it numeric?
 */
function isNumeric(value) {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

/**
 * Convert the given value to either an integer or a float (whatever is most
 * applicable).  If value is not numeric then simply return as-is.
 *
 * @param {*} value             Value to try and convert.
 * @returns {*|integer|float}   Converted (or original) value.
 */
function toTypedNumber(value) {
  if (!isNumeric(value)) return value;
  let _value = value.toString().trim();
  if (xIsInt.test(_value)) return parseInt(_value, 10);
  return parseFloat(_value);
}

module.exports = {
  isNumeric, toTypedNumber
};