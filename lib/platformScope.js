'use strict';

/**
 * Create the bolt object.
 *
 * @private
 * @returns {Object}
 */
function _createBoltObject(bolt, boltRootDir) {
  return Object.assign(
    bolt,
    bolt.require.sync(boltRootDir + '/lib/lodash'),
    bolt.require.sync('map-watch'), {
      annotation: new (bolt.require.sync('object-annotations'))()
    },
    {__modules: new Set()}
  );
}

function _addAnnotationParsers(bolt) {
  bolt.annotation.addParser(value=>{
    // @annotation key browser-export
    return (((value === '')||(value === undefined))?true:bolt.toBool(value));
  });
}

/**
 * Create and setup the scopes used in the platform via require-extra.  Return bolt object.
 *
 * @private
 * @returns {Object}    The bolt object.
 */
function createPlatformScope(bolt, boltRootDir) {
  _createBoltObject(bolt, boltRootDir);
  _addAnnotationParsers(bolt);

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