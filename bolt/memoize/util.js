'use strict';

const isFunction = require('lodash.isfunction');
const isObject = require('lodash.isobject');
const omit = require('lodash.omit');
const camelCase = require('lodash.camelcase');

const FAIL = Symbol('FAIL');

const defaultResolvers = [
	first=>first,
	(first, second)=>[first, second],
	(first,second,third)=>[first, second, third]
];

function parseOptions(options={}) {
	const {
		resolver=defaultResolvers[0],
		cache=new Map(),
		noCache=()=>false,
		cacheParams=1,
		type='function'
	} = (isFunction(options) ? {resolver:options} : options);

	return {
		resolver:(((cacheParams > 1) && (resolver === defaultResolvers[0])) ?
			defaultResolvers[cacheParams] || defaultResolvers[0] :
				resolver
		),
		cache,
		noCache,
		cacheParams,
		type
	};
}


function objectLength(obj) {
	return Object.keys(obj).length;
}

function wrap(memoized, cache=new Map()) {
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
	return FAIL;
}

function setCache(lookupId, value, cache, cacheParams=1) {
	if (cacheParams === 1) return cache.set(lookupId, value);
	if (!cache.has(lookupId[0])) cache.set(lookupId[0], new Map());
	if (cacheParams === 2) return cache.get(lookupId[0]).set(lookupId[1], value);
	if (!cache.get(lookupId[0]).has(lookupId[1])) cache.get(lookupId[0]).set(lookupId[1], new Map());
	return cache.get(lookupId[0]).get(lookupId[1]).set(lookupId[2], value);
}

module.exports = {
	isFunction, isObject, omit, getFromCache, setCache, objectLength, wrap, FAIL, parseOptions,
	defaultResolvers, camelCase
};