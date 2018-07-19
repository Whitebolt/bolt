'use strict';
// @annotation zone server manager

/**
 * @module bolt/bolt
 */

const collectionLogic = require('./database/collectionLogic');

/**
 * Make a connection to all databases defined in the supplied config.
 *
 * @private
 * @param {Object} interfaces               Loaded database interfaces.
 * @param {BoltApplication} app             Bolt application instance.
 * @param {BoltConfig} config               Bolt config object containing database connection info.
 * @returns {Promise.<BoltApplication>}     Promise resolving to the Bolt Application instance.
 */
function _loadDatabases(interfaces, app, config=app.locals) {
	app.dbs = app.dbs || {};
	let databases = Object.keys(config.databases);

	return Promise.all(databases.map(dbName=>{
		let options = config.databases[dbName];
		let loader = interfaces[options.type];

		return loader(options).then(database=>{
			app.dbs[dbName] = database;
			if (options.default) app.db = database;
		});
	})).then(()=>app);
}

/**
 * Make a connection to all databases defined in the supplied config. Fire appropriate events and hooks, returning the
 * Bolt Application instance.
 *
 * @public
 * @param {Object} interfaces               Loaded database interfaces.
 * @param {BoltApplication} app             Bolt application instance.
 * @returns {Promise.<BoltApplication>}
 */
function loadDatabases(interfaces, app) {
	return bolt.emitThrough(()=>_loadDatabases(interfaces, app), 'loadDatabases', app).then(()=>app);
}

/**
 * Import interface methods, including the loader into supplied export object. Each named export will be a loader
 * function. Extra methods on the interface will be properties of that loader function.
 *
 * @private
 * @param {Object} interfaces         Loaded database interfaces.
 * @param {Object} exports            Exports object to import into.
 * @returns {Object}                  The exports object, mutated to include interface methods.
 */
function _importInterfaces(interfaces, exports) {
	Object.keys(interfaces).forEach(interfaceName=>{
		exports[interfaces[interfaceName].name] = interfaces[interfaceName];
		Object.keys(interfaces[interfaceName]).forEach(loaderProp=>{
			if (bolt.isFunction(interfaces[interfaceName][loaderProp])) {
				exports[loaderProp] = interfaces[interfaceName][loaderProp];
			}
		});
	});

	return exports;
}

/**
 * Create exports object.
 *
 * @public
 * @returns {Promise.<Object>}    The object to export.
 */
function _exports() {
	return require.import('./database/interfaces/', {
		merge:true,
		basedir:__dirname,
		parent: __filename
	}).then(interfaces=>{
		let exports = {loadDatabases: loadDatabases.bind({}, interfaces)};
		_importInterfaces(interfaces, exports);
		return Object.assign(exports, collectionLogic);
	});
}

module.exports = _exports();
