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

function runSeries(async, series, ...params) {
  if (async === true) return _runAsyncSeries(series, ...params);
  if (!bolt.isBoolean(async)) {
    params.unshift(series);
    series = async;
  }

  series.forEach(item=>item(...params));
}

function _runAsyncSeries(series, ...params) {
  function next(item) {
    return Promise.resolve(item(...params)).then(()=>
      ((series.length)?next(series.shift()):Promise.resolve())
    );
  }
  if (series.length) return next(series.shift());
}

module.exports = {
  parseParameters, runSeries
};