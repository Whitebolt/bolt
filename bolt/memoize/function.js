'use strict';

const {isObject, omit, objectLength, wrap, getFromCache, setCache, FAIL, parseOptions} = require('./util');


function memoizeFunction(fn, options) {
	const {resolver, cache, noCache, cacheParams} = parseOptions(options);

	function memoized(...params) {
		const fnOptions = params[params.length-1];
		if (!!fnOptions && isObject(fnOptions) && !!fnOptions.noCache) {
			const _fnOptions = omit(params.pop(), ['noCache']);
			if (objectLength(_fnOptions) > 1) return fn(...params, omit(_fnOptions, ['noCache']));
			return fn(...params);
		}
		if (noCache()) return fn(...params);

		const lookupId = resolver(...params);
		const saved = getFromCache(lookupId, memoized.cache, cacheParams);
		if (saved !== FAIL) {
			const [err, data] = saved;
			if (!err) return data;
			throw err;
		}

		try {
			const result = fn(...params);
			setCache(lookupId, [null, result], memoized.cache, cacheParams);
			return result;
		} catch (err) {
			setCache(lookupId, [err, undefined], memoized.cache, cacheParams);
			throw err;
		}
	}
	return wrap(memoized, cache);
}

module.exports = {
	memoizeFunction
};