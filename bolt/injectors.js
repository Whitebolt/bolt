'use strict';
// @annotation zone server

/**
 * @module bolt/bolt
 */


const path = require('path');

async function _loadInjectors(app) {
	const paths = bolt.makeArray(app.config.root).map(root=>path.join(root,'injectors'));
	const injectors = await require.import(paths, {
		onload: (injectorPath, exports)=>{
			bolt.emit('injectorLoaded', injectorPath);
			bolt.annotation.from(exports);
		}
	});

	bolt.get(app, 'injectors', {}, true);

	bolt.forIn(injectors, (injector, _name)=>{
		const name = bolt.annotation.get(injector, 'name',  injector.name || _name);
		app.injectors[name] = injector;
	});
}

async function loadInjectors(app) {
	await bolt.emitThrough(()=>_loadInjectors(app), 'loadInjectors', app);
}

module.exports = {
	loadInjectors
};