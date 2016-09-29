'use strict';

/**
 * @module bolt/bolt
 */

const Promise = require('bluebird');

module.exports = require('require-extra').importDirectory('./database/interfaces/', {
  merge: true,
  useSyncRequire: true
}).then(interfaces=>{

  function _loadDatabases(app, config=app.config.databases) {
    app.dbs = app.dbs || {};
    let databases = Object.keys(config);

    return Promise.all(databases.map(dbName => {
      let options = config[dbName];
      let loader = interfaces[options.type];

      return loader(options).then(database => {
        app.dbs[dbName] = database;
        if (options.default) {
          app.db = database;
        }
      });
    })).then(() => app);
  }

  function loadDatabases(app) {
    return bolt.fire(()=>_loadDatabases(app), 'loadDatabases', app).then(() => app);
  }


  return Object.assign({
    loadDatabases,
    mongoId:interfaces.mongodb.mongoId,
    loadMongo:interfaces.mongodb
  }, require('./database/collectionLogic'));
});
