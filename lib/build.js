'use strict';

function _clearCache(cache) {
	if (cache instanceof Set) cache.clear();
}

function clearCache(name) {
	if (name in bolt) {
		if (bolt[name] instanceof Set) {
			_clearCache(bolt[name]);
		} else if (bolt.isObject(bolt[name])) {
			Object.keys(bolt[name]).forEach(prop=>_clearCache(bolt[name][prop]));
		}

		delete bolt[name];
	}
}

module.exports = {clearCache};