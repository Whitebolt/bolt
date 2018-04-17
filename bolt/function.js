'use strict';
// @annotation browser-export

const xQuoted = /^(["'])(.*)\1$/;
const xObject = /^\{.*\}$/;
const xArray = /^\[.*\]$/;
const xPreFunctionParams = /\)[\s\S]*/;
const xPostFunctionParams = /^.*?\(/;
const paramDefaultMatchers = new Map([['null',null],['undefined',undefined],['true',true],['false',false]]);

let getParameters;

/**
 * Parse the source of a function returning an array of parameter names.
 *
 * @public
 * @param {Function|String} func       Function or function source to parse.
 * @returns {Array.<string>}           Array of parameter names.
 */
function parseParameters(func, evaluate=true) {
	getParameters = getParameters || bolt.replaceSequence([[xPreFunctionParams],[xPostFunctionParams]]);
	const defaults = new Map();
	const params = bolt.chain(getParameters(func).split(','))
		.map(param=>param.trim())
		.map(param=>{
			const [paramName, defaultValue] = param.split('=').map(item=>item.trim());
			if (defaultValue) {
				if (xQuoted.test(defaultValue)) {
					const _defaultValue = xQuoted.exec(defaultValue)[2];
					defaults.set(paramName, ()=>()=>_defaultValue);
				} else if (paramDefaultMatchers.has(defaultValue)) {
					const _defaultValue = paramDefaultMatchers.get(defaultValue);
					defaults.set(paramName, ()=>_defaultValue);
				} else if (bolt.isNumeric(defaultValue)) {
					if (defaultValue.indexOf('.') !== -1) {
						const _defaultValue = parseFloat(defaultValue);
						defaults.set(paramName, ()=>_defaultValue);
					} else {
						const _defaultValue = parseInt(defaultValue, 10);
						defaults.set(paramName, ()=>_defaultValue);
					}
				} else if (xArray.test(defaultValue) || xObject.test(defaultValue)) {
					defaults.set(paramName, ()=>JSON.parse(defaultValue));
				} else {
					defaults.set(paramName, ()=>defaultValue);
				}
			}
			return paramName;
		});

	if (!evaluate) return [params, defaults];
	const _params = params.value();
	_params.defaults = defaults;
	return _params;
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