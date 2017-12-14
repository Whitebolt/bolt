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
    bolt.requireX.sync('lodash'),
    bolt.requireX.sync('map-watch'), {
      annotation: new (bolt.requireX.sync('object-annotations'))()
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
    express: bolt.requireX.sync('express')
  };

  bolt.requireX.on('evaluate', event=>{
    if (event.moduleConfig.filename.indexOf('/node_modules/') === -1) event.moduleConfig.scope = scope;
  });

  scope.boltAppID = bolt.requireX.sync('./bolt/string').randomString();
}

module.exports = createPlatformScope;