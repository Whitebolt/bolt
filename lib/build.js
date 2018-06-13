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

function setVirtualJsFile(name, compiled) {
	if (compiled.file) bolt.setVirtualFile(`/lib/${name}.js`, compiled.file, 'application/javascript');
	if (compiled.sourceMap) bolt.setVirtualFile(`/lib/${name}.js.map`, compiled.sourceMap, 'application/json');
	if (compiled.minFile) bolt.setVirtualFile(`/lib/${name}.min.js`, compiled.minFile, 'application/javascript');
	if (compiled.minSourceMap) bolt.setVirtualFile(`/lib/${name}.min.js.map`, compiled.minSourceMap, 'application/json');
}

module.exports = {
	setVirtualJsFile, clearCache
};