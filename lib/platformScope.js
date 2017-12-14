'use strict';

/**
 * Create the bolt object.
 *
 * @private
 * @returns {Object}
 */
function _createBoltObject(bolt) {
  return Object.assign(
    bolt,
    bolt.require.sync('lodash'),
    bolt.require.sync('map-watch'), {
      annotation: new (bolt.require.sync('object-annotations'))()
    },
    {__modules: new Set()}
  );
}

/**
 * Create and setup the scopes used in the platform via require-extra.  Return bolt object.
 *
 * @private
 * @returns {Object}    The bolt object.
 */
function createPlatformScope(bolt, boltRootDir) {
  _createBoltObject(bolt);
  const scope = {
    bolt,
    boltRootDir,
    express: bolt.require.sync('express')
  };

  bolt.require.on('evaluate', event=>{
    if (event.moduleConfig.filename.indexOf('/node_modules/') === -1) event.moduleConfig.scope = scope;
  });

  scope.boltAppID = bolt.require.sync('./bolt/string').randomString();
}

module.exports = createPlatformScope;