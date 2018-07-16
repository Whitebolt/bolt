'use strict';

const path = require('path');

const xUseStrict = /["']use strict["'](?:\;|)/;

let bolt, fileCache, filePaths;

function _setMethodAnnotations(exports) {
	bolt.functions(exports).forEach(methodName=>{
		bolt.annotation.from(exports[methodName].toString(), exports[methodName]);
	});
}

function _wrapModuleInFunction(target) {
	return `function(){${fileCache.get(target).toString().replace(xUseStrict,'')}}`;
}

function _parseModuleAnnotations(target, exports) {
	if (fileCache.has(target)) bolt.annotation.from(_wrapModuleInFunction(target), exports);
	if (bolt.isObject(exports)) _setMethodAnnotations(exports);
	bolt.annotation.set(exports, 'modulePath', target);
}

function provideBolt(_bolt) {
	bolt = _bolt;
	fileCache = bolt.require.getStore('fileCache');
	filePaths = bolt.require.getStore('filePaths');
	return _bolt;
}

function loadLibModule(moduleId, sync=true) {
	if (Array.isArray(moduleId)) {
		const exports = moduleId.map(moduleId=>loadLibModule(moduleId, sync));
		return (sync ?
			Object.assign({}, ...exports) :
			Promise.all(exports).then(exports, Object.assign({}, ...exports))
		);
	}
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

async function loadBoltModules(loadPath, boltImportOptions, allowedZones) {
	await bolt.require.import(loadPath, {
		merge: true,
		imports: bolt,
		retry: true,
		onload: async(target, exports)=> {
			const event = new bolt.BoltModuleReadyEvent({
				type: 'boltModuleReady',
				sync: false,
				target,
				exports,
				allowedZones,
				unload: false
			});
			if (!!bolt.emit) await bolt.emit('boltModuleReady', event);
			onBoltModuleReady(event);
			return !event.unload;
		},
		onerror: error=> {
			bolt.waitEmit('initialiseApp', 'boltModuleFail', error.source);
			console.error(error.error);
		},
		...boltImportOptions
	});

	return bolt;
}

function loadBoltModule(moduleId, sync=true) {
	const exports = bolt.require.try(sync, [...bolt.__paths].map(dir=>path.join(dir, 'bolt', moduleId)));
	if (!!exports) onBoltModuleReady({exports, target:filePaths.get(exports)});

	return exports;
}

module.exports = {
	loadBoltModule, loadBoltModules, loadLibModule, provideBolt
};