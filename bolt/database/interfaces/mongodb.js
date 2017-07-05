'use strict';

const Promise = require('bluebird');
const mongo = require('mongodb');

/**
 * Get a mongo url from given config object.
 *
 * @private
 * @param {BoltConfigDb} options    The database config connection object
 * @returns {string}                The connection url or blank string.
 */
function _createMongoUrl(options) {
  options.server = options.server || 'localhost';
  options.port = options.port || 27017;

  return `mongodb://${_createMongoAuthenticationPart(options)}${options.server}:${options.port}/${options.database}${options.username ? '?authSource=' + options.adminDatabase : ''}`
}

/**
 * Create the authentication part of a database connection url from a database config object.
 *
 * @private
 * @param {BoltConfigDb} options    The database config connection object.
 * @returns {string}                The authentication section of a database url.
 */
function _createMongoAuthenticationPart(options) {
  if (options.username) {
    options.adminDatabase = options.adminDatabase || 'admin';
    return encodeURIComponent(options.username)
      + (options.password ? ':' + encodeURIComponent(options.password) : '')
      + '@';
  }

  return '';
}

/**
 * @external Db
 * @see {https://github.com/mongodb/node-mongodb-native/blob/2.2/lib/db.js}
 */

/**
 * Connect to a mongo database.
 *
 * @public
 * @param {BoltConfigDb} options        The database config object.
 * @returns {Promise.<external:Db>}     The  mongo database instance object.
 */
function loadMongo(options) {
  return mongo.MongoClient.connect(_createMongoUrl(options), {
    uri_decode_auth: true,
    promiseLibrary: Promise
  }).then(results=>{
    if (global.bolt && bolt.fire) bolt.fire('mongoConnected', options.database);
    return results;
  })
}

/**
 * @external ObjectId
 * @see {https://github.com/mongodb/js-bson/blob/1.0-branch/lib/bson/objectid.js}
 */

/**
 * Get a mongo id for the given id value.
 *
 * @public
 * @param {*} id                   Value, which can be converted to a mongo-id.
 * @returns {external:ObjectId}    Mongo-id object.
 */
function mongoId(id) {
  return new mongo.ObjectID(id);
}

loadMongo.mongoId = mongoId;

module.exports = loadMongo;
