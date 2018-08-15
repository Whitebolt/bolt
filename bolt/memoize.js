'use strict';
// @annotation zone server gulp

const {parseOptions, camelCase} = require('./memoize/util');
const {memoizeFunction} = require('./memoize/function');
const {memoizePromise} = require('./memoize/promise');
const {memoizeNodeCallback} = require('./memoize/nodeCallback');
const {memoizeRegExp} = require('./memoize/regexp');


function memoize2(fn, options) {
	const _options = parseOptions(options);
	const methodName = camelCase(_options.type);

	if (memoize2.hasOwnProperty((methodName))) return memoize2[methodName](fn, _options);
}

memoize2.function = memoizeFunction;
memoize2.nodeCallback = memoizeNodeCallback;
memoize2.promise = memoizePromise;


module.exports = {
	memoize2, memoizeRegExp
};