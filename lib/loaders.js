'use strict';

const path = require('path');

const xUseStrict = /["']use strict["'](?:\;|)/;

let bolt, fileCache, filePaths;


function _parseModuleAnnotations(target, exports) {

	if (fileCache.has(target)) bolt.annotation.from(
		`function(){${fileCache.get(target).toString().replace(xUseStrict,'')}}`, exports
	);
	if (bolt.isObject(exports)) bolt.functions(exports).forEach(methodName=>{
		bolt.annotation.from(exports[methodName].toString(), exports[methodName]);
	});
	bolt.annotation.set(exports, 'modulePath', target);
}

function provideBolt(_bolt) {
	bolt = _bolt;
	fileCache = bolt.require.getStore('fileCache');
	filePaths = bolt.require.getStore('filePaths');
	return _bolt;
}

function loadLibModule(moduleId, sync=true) {
	return bolt.require.try(sync, [...bolt.__paths].map(dir=>path.join(dir, 'lib', moduleId)));
}

function onBoltModuleReady(event) {
	const {target, exports, allowedZones} = event;
	_parseModuleAnnotations(target, exports);

	const zones = bolt.annotation.get(exports, 'zone') || new Set();
	if (!!allowedZones && !allowedZones.find(zone=>zones.has(zone))) {
		event.unload = true;
		return;
	}

	if (!!bolt.waitEmit) bolt.waitEmit('initialiseApp', 'boltModuleLoaded', target);

	bolt.__modules = bolt.__modules || new Set();
	return bolt.__modules.add(target);
}

function loadBoltModule(moduleId, sync=true) {
	const exports = bolt.require.try(sync, [...bolt.__paths].map(dir=>path.join(dir, 'bolt', moduleId)));
	if (!!exports) onBoltModuleReady({exports, target:filePaths.get(exports)});

	return exports;
}

module.exports = {
	loadBoltModule, loadLibModule, onBoltModuleReady, provideBolt
};