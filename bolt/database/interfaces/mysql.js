'use strict';

const Promise = require('bluebird');
const mysql = require('mysql-promise');
const queryBuilder = require('mongo-sql');

const xDollarDigit = /\$\d+/g;
const xDoubleQuotes = /\"/g;

const mutateToMySqlFormat = bolt.replaceSequence([[xDollarDigit, '?'],[xDoubleQuotes]]);

/**
 * @external MysqlConnectionConfig
 * @see {https://github.com/mysqljs/mysql/blob/master/lib/ConnectionConfig.js}
 */

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
    timezone:'Z'
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
  return queryMethod.call(db, mutateToMySqlFormat(_query), _query.values);
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
function loadMysql(config) {
  let db = mysql(config.database);
  db.configure(_getDbConfig(config));
  db.query = _query.bind(db, db, db.query);

  bolt.fire('SQLConnected', config.database);

  return Promise.resolve(db);
}

module.exports = loadMysql;
