'use strict';

const {memoizeFunction} = require('./function');

function memoizeRegExp(rx) {
	const cache = new Map();

	function getCache(cacheId) {
		if (!cache.has(cacheId)) cache.set(cacheId, new Map());
		return cache.get(cacheId);
	}

	const _rx = new RegExp(rx.source, rx.flags);
	const memoizedTest = memoizeFunction(rx.test.bind(rx));
	const replaceCache = getCache('replaceCache');
	const matchCache = getCache('matchCache');
	const execCache = getCache('execCache');

	const memoized = {
		test(value, useCache=true) {
			if (!useCache) return rx.test(value);
			return memoizedTest(value);
		},

		replace(value, replaceString, useCache=true) {
			if (!useCache) return value.replace(rx, replaceString);
			if (!replaceCache.has(value)) replaceCache.set(value, memoizeFunction(value.replace.bind(value), (rx, rs)=>rs));
			return replaceCache.get(value)(rx, replaceString);
		},

		match(value, useCache=true) {
			if (!useCache) return value.replace(rx, replaceString);
			if (!matchCache.has(value)) matchCache.set(value, memoizeFunction(value.match.bind(value)));
			return matchCache.get(value)(rx);
		},

		exec(value, useCache=true) {
			if (!useCache) return rx.exec(value);
			if (!execCache.has(value)) execCache.set(value, new Map());
			if (!execCache.get(value).has(rx.lastIndex)) {
				execCache.get(value).set(rx.lastIndex, rx.exec(value));
			}
			return execCache.get(value).get(rx.lastIndex);
		},

		clear() {
			cache.forEach(cache=>cache.clear());
		}
	};

	return Object.assign(_rx, memoized);
}

module.exports = {
	memoizeRegExp
};