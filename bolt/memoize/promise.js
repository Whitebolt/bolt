'use strict';

const {isObject, omit, objectLength, wrap, getFromCache, setCache, FAIL, parseOptions} = require('./util');

function memoizePromise(fn, options) {
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
			const [err, ...data] = saved;
			if (!!err) return Promise.reject(err);
			return Promise.resolve(((data.length > 1) ? data : data[0]));
		}

		return fn(...params).then((...data)=>{
			setCache(lookupId, [null, ...data], memoized.cache, cacheParams);
			return ((data.length > 1) ? data : data[0]);
		}, err=>{
			setCache(lookupId, [err], memoized.cache, cacheParams);
			return Promise.reject(err);
		});
	}

	return wrap(memoized, cache);
}

module.exports = {
	memoizePromise
};