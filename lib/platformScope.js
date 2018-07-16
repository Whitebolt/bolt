'use strict';

/**
 * Create the bolt object.
 *
 * @private
 * @returns {Object}
 */
function _createBoltObject(bolt, boltRootDir) {
	if (!('__modules' in bolt)) bolt.__modules = new Set();
	bolt.__modules.add('lodash');

	return bolt;
}

/**
 * Create and setup the scopes used in the platform via require-extra.  Return bolt object.
 *
 * @private
 * @returns {Object}    The bolt object.
 */
function createPlatformScope(bolt, boltRootDir, extraScope=[]) {
	_createBoltObject(bolt, boltRootDir);

	const scope = {
		bolt,
		boltRootDir,
		express: bolt.require.sync('express')
	};

	bolt.castArray(extraScope).forEach(item=>{
		if (bolt.isFunction(item)) scope[item.name || item.displayName] = item;
	});

	bolt.require.on('evaluate', event=>{
		if (event.moduleConfig.filename.indexOf('/node_modules/') === -1) {
			event.moduleConfig.scope = scope;
		}
	});

	scope.boltAppID = scope.loadBoltModule('string').randomString();
}

module.exports = {
	createPlatformScope
};