'use strict';

const xPreFunctionParams = /\)[\s\S]*/;
const xPostFunctionParams = /^.*?\(/;

/**
 * Parse the source of a function returning an array of parameter names.
 *
 * @public
 * @param {Function|String} func       Function or function source to parse.
 * @returns {Array.<string>}           Array of parameter names.
 */
function parseParameters(func) {
  return (bolt.isString(func) ? func : func.toString())
    .replace(xPreFunctionParams, '')
    .replace(xPostFunctionParams, '')
    .split(',')
    .map(param=>param.trim());
}

module.exports = {
  parseParameters
};