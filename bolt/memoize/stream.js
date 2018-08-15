'use strict';

const {isObject, omit, objectLength, wrap, getFromCache, setCache, FAIL, parseOptions} = require('./util');
const {Readable} = require('stream');

function memoizeStream(fn, options) {
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

	return wrap(memoized, cache);
}

module.exports = {
	memoizeStream
};