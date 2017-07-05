'use strict';

/**
 * @module bolt/bolt
 */

const Promise = require('bluebird');
const requireX = require('require-extra');
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
function _loadDatabases(interfaces, app, config=app.config) {
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
  return bolt.fire(()=>_loadDatabases(interfaces, app), 'loadDatabases', app).then(()=>app);
}

/**
 * Create exports object.
 *
 * @public
 * @returns {Promise.<Object>}    The object to export.
 */
function exports() {
  return requireX.importDirectory('./database/interfaces/', {merge: true, useSyncRequire: true}).then(interfaces=>{
    let exports = {
      loadDatabases: loadDatabases.bind({}, interfaces),
      mongoId:interfaces.mongodb.mongoId,
      loadMongo:interfaces.mongodb
    };

    return Object.assign(exports, collectionLogic);
  });
}

module.exports = exports();
