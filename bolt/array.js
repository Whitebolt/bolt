'use strict';

/**
 * @module bolt/bolt
 */

/**
 * Always return an array.  If the provided parameter is an array then return
 * it as-is.  If provided param is not an array return param as first item
 * of an array. If a convertFunction is supplied the default non-array to array
 * conversion can be overridden.
 *
 * Function is useful when you always need a value to be array to use array
 * functions (such as map or forEach) on it but cannot guarantee it will be.
 *
 * @public
 * @param {*} ary                                     Item to return or
 *                                                    convert to an array.
 * @param {function} [convertFunction=(ary)=>[ary]]   Function used to convert
 *                                                    to an array if not
 *                                                    already one.
 * @returns {Array}                                   New array or supplied
 *                                                    parameter returned.
 */
function makeArray(ary, convertFunction=(ary)=>[ary]) {
  return (Array.isArray(ary) ? ary : convertFunction(ary));
}

/**
 * Sort an array according to it item's priority property.
 *
 * @param {Object} a    First sort item.
 * @param {Object} b    Second sort item.
 * @returns {integer}   Sort order for items a & b (-1, 0, or 1).
 */
function prioritySorter(a, b) {
  let aP = (a !== undefined ? (a.hasOwnProperty('priority') ? a.priority : 1) : 1);
  let bP = (a !== undefined ? (b.hasOwnProperty('priority') ? b.priority : 1) : 1);
  return ((aP > bP)?1:((aP < bP)?-1:0));
}

module.exports = {
  makeArray, prioritySorter
};