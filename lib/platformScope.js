'use strict';

/**
 * Create the bolt object.
 *
 * @private
 * @returns {Object}
 */
function _createBoltObject(bolt, boltRootDir) {
	const lodashPath = boltRootDir + '/lib/lodash';
	if (!('__modules' in bolt)) bolt.__modules = new Set();
	bolt.__modules.add(lodashPath);

	return Object.assign(
		bolt,
		bolt.require.sync('@simpo/map-watch'), {
			requireLib: id=>bolt.require.sync(`${boltRootDir}/lib/${id}`)
		}
	);
}

/**
 * Create and setup the scopes used in the platform via require-extra.  Return bolt object.
 *
 * @private
 * @returns {Object}    The bolt object.
 */
function createPlatformScope(bolt, boltRootDir) {
	_createBoltObject(bolt, boltRootDir);

	const scope = {
		bolt,
		boltRootDir,
		express: bolt.require.sync('express')
	};

	bolt.require.on('evaluate', event=>{
		if (event.moduleConfig.filename.indexOf('/node_modules/') === -1) event.moduleConfig.scope = scope;
	});

	scope.boltAppID = bolt.require.sync('./bolt/string').randomString();
	delete require.cache[require.resolve('../bolt/string')];
}

module.exports = createPlatformScope;