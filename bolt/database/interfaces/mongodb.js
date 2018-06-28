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

	return `mongodb://${_createMongoAuthenticationPart(config)}${config.server}:${config.port}/${config.database}`;
}

/**
 * Create the authentication part of a database connection url from a database config object.
 *
 * @private
 * @param {BoltConfigDb} config     The database config connection object.
 * @returns {string}                The authentication section of a database url.
 */
function _createMongoAuthenticationPart(config) {
	if (config.username) return config.username + (config.password ? ':' + config.password : '') + '@';
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
async function loadMongo(config) {
	const options = {
		promiseLibrary: require('bluebird'), // @todo At some point we need to get rid of bluebird.
		appname:'bolt',
		useNewUrlParser:true,
		...bolt.get(config, 'options', {})
	};
	if (!!config.username) Object.assign(options, {
		authSource: bolt.get(config, 'options.authSource', 'admin')
	});

	const client = await mongo.MongoClient.connect(_createMongoUrl(config), options);
	const db = client.db(config.database);
	await bolt.emitThrough(()=>{}, 'mongoConnected', db);
	return db;
}

/**
 * @external ObjectId
 * @see {https://github.com/mongodb/js-bson/blob/1.0-branch/lib/bson/objectid.js}
 */


function getType(obj) {
	if (!bolt.isObject(obj)) return typeof obj;
	return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
}

function _toFromId(value, action, errorMessage) {
	const _value = ((bolt.isObject(value) && !!value._id) ? value._id : value);
	if (bolt.isString(_value)) return action(_value);
	if (loadMongo.isMongoId(_value)) return action(_value.toString());
	if (!Array.isArray(_value) && !(_value instanceof Set)) throw new TypeError(errorMessage(_value));
	const values = bolt.chainArray(_value)
		.filter(item=>!!item)
		.map(value=>_toFromId(value, action, errorMessage))
		.value();
	return (Array.isArray(_value))?values:new Set(values);
}

loadMongo.mongoId = id=>new mongo.ObjectID(id);
loadMongo.toId = value=>_toFromId(
	value,
	value=>loadMongo.mongoId(value),
	value=>`Cannot convert ${getType(value)}, to MongoId because it is not an Array, Set or string.`
);
loadMongo.fromId = value=>_toFromId(
	value,
	value=>value.toString(),
	value=>`Cannot convert ${getType(value)}, from MongoId because it is not a MongoId`
);
loadMongo.sessionStore = (session, app, db=app.config.sessionStoreDb || 'main')=>{
	const MongoStore = require('connect-mongo')(session);
	return new MongoStore({db: app.dbs[db]});
};

loadMongo.isMongoId = id=>(id instanceof mongo.ObjectID);

module.exports = loadMongo;
