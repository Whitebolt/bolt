'use strict';

function parseParameters(func) {
  return (bolt.isString(func) ? func : func.toString())
    .replace(/\)[\s\S]*/, '')
    .replace(/^.*?\(/, '')
    .split(',')
    .map(param=>param.trim());
}

module.exports = {
  parseParameters
};