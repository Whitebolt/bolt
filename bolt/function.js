'use strict';

const string = require('./string');

const xPreFunctionParams = /\)[\s\S]*/;
const xPostFunctionParams = /^.*?\(/;
const getParameters = string.replaceSequence([[xPreFunctionParams],[xPostFunctionParams]]);

/**
 * Parse the source of a function returning an array of parameter names.
 *
 * @public
 * @param {Function|String} func       Function or function source to parse.
 * @returns {Array.<string>}           Array of parameter names.
 */
function parseParameters(func) {
  return getParameters(func).split(',').map(param=>param.trim());
}

module.exports = {
  parseParameters
};