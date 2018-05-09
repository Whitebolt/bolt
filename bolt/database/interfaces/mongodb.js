'use strict';

const mongo = require('mongodb');

/**
 * Get a mongo url from given config object.
 *
 * @private
 * @param {BoltConfigDb} config     The database config connection object
 * @returns {string}                The connection url or blank string.
 */
function _createMongoUrl(config) {
	config.server = config.server || 'localhost';
	config.port = config.port || 27017;

	return `mongodb://${_createMongoAuthenticationPart(config)}${config.server}:${config.port}/${config.database}${config.username ? '?authSource=' + config.adminDatabase : ''}`
}

/**
 * Create the authentication part of a database connection url from a database config object.
 *
 * @private
 * @param {BoltConfigDb} config     The database config connection object.
 * @returns {string}                The authentication section of a database url.
 */
function _createMongoAuthenticationPart(config) {
	if (config.username) {
		config.adminDatabase = config.adminDatabase || 'admin';
		return encodeURIComponent(config.username)
			+ (config.password ? ':' + encodeURIComponent(config.password) : '')
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
 * @param {BoltConfigDb} config        The database config object.
 * @returns {Promise.<external:Db>}    The  mongo database instance object.
 */
function loadMongo(config) {
	return mongo.MongoClient.connect(_createMongoUrl(config), {
		// @todo At some point we need to get rid of bluebird as now using async/await.
		promiseLibrary: require('bluebird')
	}).then(client=>{
		const db = client.db(config.database);
		return bolt.emitThrough(()=>{}, 'mongoConnected', db).then(()=>db);
	});

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

loadMongo.sessionStore = function(session, app, db=app.config.sessionStoreDb || 'main') {
	const MongoStore = require('connect-mongo')(session);
	return new MongoStore({db: app.dbs[db]});
};

module.exports = loadMongo;
