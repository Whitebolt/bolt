'use strict';
// @annotation zone server gulp manager browser

const {memoizeRegExp} = require('./memoize');

const consts = {
	xNull: /\0/,
	xIsJs: /\.js$/,
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
	xSubstitutionsAt: /@\{(.*?)\}/g,
	xTemplateIdAt: /\@\{/g,
	chars: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'.split(''),
	xStackFindProxy: /[\S\s]+ Proxy\.([^\s]+) \((.*?)\:/,
	xCasted: /\:\:(.*)/,
	xDollarDigit: /\$\d+/g,
	xDoubleQuotes: /\"/g,
	isBrowser: (function(){try {return !!window;} catch (err) {return false;}})()
};

module.exports = {
	consts
};

// @todo Need a better way than this hack!
if (consts.isBrowser) window.bolt = Object.assign(window.bolt || {}, module.exports);