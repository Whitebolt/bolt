'use strict';
// @annotation zone server gulp manager

const {memoizeRegExp} = require('./memoize');

const consts = {
	xSpaces: /\s+/,
	xNewLine: /\n/,
	xTrailingSlash: memoizeRegExp(/\/$/),
	xSlash: memoizeRegExp(/\//g),
	xIsSync: /Sync$/,
	xQuoted: /^(["'])(.*)\1$/,
	xObject: /^\{.*\}$/,
	xArray: /^\[.*\]$/,
	xPreFunctionParams: /\)[\s\S]*/,
	xPostFunctionParams: /^.*?\(/,
	paramDefaultMatchers: new Map([['null',null],['undefined',undefined],['true',true],['false',false]]),
	xParseGulpLog: /^\[(\d\d\:\d\d\:\d\d)\]\s+(.*)/,
	xAnsi: /\x1b\[[0-9;]*[a-zA-Z]/g,
	xGulpUsing: /^Using gulpfile /,
	xGetGulpTaskNamePath: /^Found task \'(.*?)\' in (.*)/,
	xGulpFinishedAfter: /^Finished \'.*?\' after .*$/,
	xGetGulpTaskName: /^Starting \'(.*?)\'/,
	xStartDigitUnderscore: /^\d+_/,
	xIsInt: /^[0-9]+$/,
	xIsRequireId: /^require\./,
	xSubstitutions: /\$\{(.*?)\}/g,
	chars: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'.split(''),
	xStackFindProxy: /[\S\s]+ Proxy\.([^\s]+) \((.*?)\:/,
	xCasted: /\:\:(.*)/,
	xDollarDigit: /\$\d+/g,
	xDoubleQuotes: /\"/g
};


module.exports = {
	consts
};