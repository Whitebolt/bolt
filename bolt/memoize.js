'use strict';

const _defaultResolver = first=>first;


function _memoize(memoized, cache=new Map()) {
	memoized.cache = cache;
	return memoized;
}

function memoize(fn, options) {
	const {resolver=_defaultResolver, cache=new Map()} = (bolt.isFunction(options) ? {resolver:options} : options);

	function memoized(...params) {
		const lookupId = resolver(...params);
		if (memoized.cache.has(lookupId)) {
			const [err, data] = memoized.cache.get(lookupId);
			if (!err) return data;
			throw err;
		}

		try {
			const result = fn(...params);
			memoized.cache.set(lookupId, [null, result]);
			return result;
		} catch (err) {
			memoized.cache.set(lookupId, [err, undefined]);
			throw err;
		}
	}
	return _memoize(memoized, cache);
}

function memoizeNode(fn, options) {
	const {resolver=_defaultResolver, cache=new Map()} = (bolt.isFunction(options) ? {resolver:options} : options);

	function memoized(...params) {
		const cb = params.pop();
		const lookupId = resolver(...params);
		if (memoized.cache.has(lookupId)) return cb(...memoized.cache.get(lookupId));
		return fn(...params, (...result)=>{
			memoized.cache.set(lookupId, result);
			return cb(...result);
		});
	}
	return _memoize(memoized, cache);
}

function memoizePromise(fn, options) {
	const {resolver=_defaultResolver, cache=new Map()} = (bolt.isFunction(options) ? {resolver:options} : options);

	function memoized(...params) {
		const lookupId = resolver(...params);
		if (memoized.cache.has(lookupId)) {
			const [err, ...data] = memoized.cache.get(lookupId);
			if (!err) return Promise.reject(err);
			return Promise.resolve(((data.length > 1) ? data : data[0]));
		}

		return fn(...params).then((...data)=>{
			memoized.cache.set(lookupId, [null, ...data]);
			return ((data.length > 1) ? data : data[0]);
		}, err=>{
			memoized.cache.set(lookupId, [err]);
			return Promise.reject(err);
		});
	}
	return _memoize(memoized, cache);
}

module.exports = {
	memoize, memoizeNode, memoizePromise
};