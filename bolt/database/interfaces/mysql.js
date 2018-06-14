'use strict';

const mysql = require('mysql2/promise');
const queryBuilder = require('mongo-sql');
const {quoteObject} = require('mongo-sql/lib/utils');

const xCasted = /\:\:(.*)/;
const xDollarDigit = /\$\d+/g;
const xDoubleQuotes = /\"/g;

const mutateToMySqlFormat = bolt.replaceSequence([[xDollarDigit, '?'],[xDoubleQuotes]]);

function _getOrderItem(field, direction, query) {
	if (bolt.isObject(field)) {
		const key = Object.keys(field)[0];
		direction = field[key];
		field = key;
	}
	if (!xCasted.test(field)) return quoteObject(field, query.__defaultTable) + ' ' + direction;
	const [match, casting] = xCasted.exec(field);
	field = field.replace(xCasted, '');
	return 'cast('+quoteObject(field, query.__defaultTable)+' as '+casting+') ' + direction;
}

// Modify the order helper to allowing casting and allow ordered key ordering
queryBuilder.registerQueryHelper( 'order', function( order, values, query ) {
	let output = 'order by ';

	if (bolt.isString(order) || Array.isArray(order)) {
		output += bolt.makeArray(order)
			.map(field=>_getOrderItem(field, 'asc', query))
			.join(', ');
	} else {
		for (let field in order) output += _getOrderItem(field, order[field], query) + ', ';
		output = output.substring(0, output.length - 2);
	}

	if (output.trim() === 'order by') return '';
	return output;
});

queryBuilder.conditionalHelpers.add('$eq', (...params)=>
	queryBuilder.conditionalHelpers.get('$equals').fn(...params)
);

/**
 * @external MysqlConnectionConfig
 * @see {https://github.com/mysqljs/mysql/blob/master/lib/ConnectionConfig.js}
 */

function zeroLead(value) {
	return ((value.toString() < 10) ? "0"+value : value).toString();
}

/**
 * Convert given BoltConfigDb type into a mysql connection config object.
 *
 * @private
 * @param {BoltConfigDb} config        The database config object.
 * @returns {MysqlConnectionConfig}    The mysql connection config object.
 */
function _getDbConfig(config) {

	return {
		host:config.server,
		user:config.username,
		password:config.password,
		database:config.database,
		dateStrings: true
	};
}

/**
 * @external MysqlResultSet
 * @see {https://github.com/mysqljs/mysql/blob/master/lib/protocol/ResultSet.js}
 */

/**
 * New query method for mysql accepting an object as well as sql string.  Objects work in a similar fashion to mongo
 * style queries.  Uses mongo-sql in the background.
 *
 * @private
 * @param {external:DB} db                The database connection.
 * @param {Function} queryMethod          The original query method from mongo-sql.
 * @param {Object|string} sql             The query object or sql string.
 * @returns {Promise<MysqlResultSet>}     The query results.
 */
function _query(db, queryMethod, sql) {
	if (bolt.isString(sql)) return queryMethod.call(db, sql);
	let _query = queryBuilder.sql(sql);
	const _sql = mutateToMySqlFormat(_query);
	_logQuery(_sql, _query.values);
	return queryMethod.call(db, _sql, _query.values);
}

function _logQuery(sql, values) {
	values.forEach(value=>{
		sql = sql.replace('?', value);
	});
	bolt.emit('sqlQuery', sql);
}

/**
 * @external DB
 * @see {https://github.com/martinj/node-mysql-promise/blob/master/index.js}
 */

/**
 * Connect to a mysql database.
 *
 * @public
 * @param {BoltConfigDb} config        The database config object.
 * @returns {Promise.<external:DB>}    The  mysql database instance object.
 */
async function loadMysql(config) {
	const pool = await mysql.createPool(_getDbConfig(config));
	const query = _query.bind(pool, pool, pool.execute);
	const series = _series.bind(pool, query);
	pool._originalDb = pool;
	pool.series = series;

	bolt.emit('SQLConnected', config.database);

	return new Proxy(pool, {
		get: (target, property, receiver)=>{
			if (property === 'query') return query;
			if (property === 'execute') return query;
			if (property === 'series') return series;
			return Reflect.get(target, property, receiver);
		}
	});
}

async function _series(query, ...queries)  {
	return (await Promise.all(queries.map(queryDef=>query(queryDef)))).map(results=>results[0]);
}

loadMysql.sessionStore = function(session, app, db=app.config.sessionStoreDb || 'main') {
	const MySqlStore = require('@simpo/express-mysql-session')(session);

	return new MySqlStore({
		createDatabaseTable: true
	}, app.dbs[db]._originalDb);
};

module.exports = loadMysql;
