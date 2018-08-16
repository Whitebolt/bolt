'use strict';

const {isObject, omit, objectLength, wrap, getFromCache, setCache, FAIL, parseOptions} = require('./util');

function memoizeNodeCallback(fn, options) {
	const {resolver, cache, noCache, cacheParams} = parseOptions(options);

	function memoized(...params) {
		const cb = params.pop();
		const fnOptions = params[params.length-1];
		if (!!fnOptions && isObject(fnOptions) && !!fnOptions.noCache) {
			const _fnOptions = omit(params.pop(), ['noCache']);
			if (objectLength(_fnOptions) > 1) return fn(...params, omit(_fnOptions, ['noCache']), cb);
			return fn(...params, cb);
		}
		if (noCache()) return fn(...params, cb);

		const lookupId = resolver(...params);
		const saved = getFromCache(lookupId, memoized.cache, cacheParams);
		if (saved !== FAIL) return cb(...saved);
		return fn(...params, (...result)=>{
			setCache(lookupId, result, memoized.cache, cacheParams);
			return cb(...result);
		});
	}

	return wrap(memoized, cache);
}

module.exports = {
	memoizeNodeCallback
};