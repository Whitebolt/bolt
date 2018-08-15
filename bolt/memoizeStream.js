'use strict';
// @annotation zone server gulp

const isObject = require('lodash.isobject');
const omit = require('lodash.omit');
const {Readable} = require('stream');

function objectLength(obj) {
	return Object.keys(obj).length;
}

function _memoize(memoized, cache=new Map()) {
	memoized.cache = cache;
	return memoized;
}

function getFromCache(lookupId, cache, cacheParams=1) {
	if (cache.has(lookupId)) {
		const lookupId1 = ((cacheParams=1)?lookupId:lookupId[0]);
		const cache1 = cache.get(lookupId1);
		if (cacheParams === 1) return cache1;
		if (('has' in cache1) && (cache1.has(lookupId[1]))) {
			const cache2 = cache1.get(lookupId[1]);
			if (cacheParams === 2) return cache2;
			if (('has' in cache2) && (cache2.has(lookupId[2]))) return cache2.get(lookupId[2]);
		}
	}
	return bolt.memoize2.FAIL;
}

function setCache(lookupId, value, cache, cacheParams=1) {
	if (cacheParams === 1) return cache.set(lookupId, value);
	if (!cache.has(lookupId[0])) cache.set(lookupId[0], new Map());
	if (cacheParams === 2) return cache.get(lookupId[0]).set(lookupId[1], value);
	if (!cache.get(lookupId[0]).has(lookupId[1])) cache.get(lookupId[0]).set(lookupId[1], new Map());
	return cache.get(lookupId[0]).get(lookupId[1]).set(lookupId[2], value);
}


bolt.memoize2.stream = function __memoizeStream(fn, {resolver, cache, noCache, cacheParams}) {
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

		if (saved !== bolt.memoize2.FAIL) {
			const stream = new Readable();
			const [err, result] = saved;
			stream._read = ()=>{};
			if (!!err) return stream.emit('error', err);
			[...result, null].forEach(data=>setImmediate(()=>stream.push(data)));
			return stream;
		}

		const storeInCache = (err, result)=>setCache(lookupId, [err, result], memoized.cache, cacheParams);
		const result = [];
		return fn(...params)
			.on('data', data=>result.push(data))
			.on('close', ()=>storeInCache(null, result))
			.on('finish', ()=>storeInCache(null, result))
			.on('end', ()=>storeInCache(null, result))
			.on('error', err=>storeInCache(err));
	}
	return _memoize(memoized, cache);
};