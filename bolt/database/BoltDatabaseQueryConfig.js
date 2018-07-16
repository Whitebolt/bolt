'use strict';

const defaults = Object.freeze({
  accessLevel: 'read',
  collection: 'pages',
  filters: Object.freeze({
    filterByVisibility:true,
    filterByAccessLevel:true,
    filterUnauthorisedFields:true
  })
});
const accessLevels = new Set('read', 'write', 'admin');

/**
 * A database query config class.  Used to hold references to the database and collection. Used to set various access
 * levels and give references to the http request object and session,
 *
 * @class BoltDatabaseQueryConfig
 * @public
 *
 * @property {string} accessLevel                   Access level to execute query under. Defaults to 'read'.
 * @property {string} collection                    Collection to query against. Defaults to 'pages'.
 * @property {BoltApplication}                      Bolt Application this relates to.  Defaults to app on the
 *                                                  request instance.
 * @property {external:express:request}             Express request object for this query.
 * @property {Object} session                       The user session object.  Defaults to session on the request
 *                                                  instance or an empty object if request has no session.
 * @property {external:ObjectId} [id]               Mongo ObjectId to use.
 * @property {Object} projection                    Projection object. Field names are keys and true/false as values.
 * @property {boolean} filterByVisibility           Filter by visibility? Defaults to true.
 * @property {boolean} filterByAccessLevel          Filter by access level? Defaults to true.
 * @property {boolean} filterUnauthorisedFields     Filter unauthorised fields from output? Defaults to true.
 * @property {Object} doc                           Document to use in operation.
 */
class BoltDatabaseQueryConfig {
  constructor(queryConfig, copyObject={}) {
    Object.assign(this, copyObject, queryConfig);
    this.collection = (this.collection || defaults.collection).toString();
    _setAccessLevel(this);
    this.app = ((this.req && !this.app) ? this.req.app : this.app);
    _setDb(this);
    this.session = this.session || (this.req ? this.req.session : {});
    if (this.id) this.id = bolt.mongoId(this.id);
    _setProjection(this);
    _ensureBoolean(this, ['filterByVisibility', 'filterByAccessLevel', 'filterUnauthorisedFields'], defaults.filters);

    Object.freeze(this);
  }

  create(options) {
    return new BoltDatabaseQueryConfig(options, this);
  }
}

/**
 * Set projection database object on  BoltDatabaseQueryConfig instance.
 *
 * @private
 * @param {BoltDatabaseQueryConfig} queryConfig     Config to set on.
 */
function _setDb(queryConfig) {
  queryConfig.db = ((bolt.isString(queryConfig.db) && queryConfig.app) ? queryConfig.app.dbs[queryConfig.db] : queryConfig.db);
  queryConfig.db = ((!queryConfig.db && queryConfig.app) ? queryConfig.app.db : queryConfig.db);
}

/**
 * Set projection values on BoltDatabaseQueryConfig instance.
 *
 * @private
 * @param {BoltDatabaseQueryConfig} queryConfig     Config to set on.
 */
function _setProjection(queryConfig) {
  if (Array.isArray(queryConfig.projection)) {
    let temp = {};
    queryConfig.projection.forEach(key=>{temp[key] = true;});
    queryConfig.projection = temp;
  } else if (!bolt.isObject(queryConfig.projection)) {
    delete queryConfig.projection;
  }

  _ensureBoolean(queryConfig);
}

/**
 * Set projection values on BoltDatabaseQueryConfig instance.
 *
 * @private
 * @param {BoltDatabaseQueryConfig} queryConfig     Config to set on.
 */
function _setProjection(queryConfig) {
  if (Array.isArray(queryConfig.projection)) {
    let temp = {};
    queryConfig.projection.forEach(key=>{temp[key] = true;});
    queryConfig.projection = temp;
  } else if (!bolt.isObject(queryConfig.projection)) {
    delete queryConfig.projection;
  }

  _ensureBoolean(queryConfig.projection);
}

/**
 * Ensure given object values are booleans.  if not delete them or set to default values.
 *
 * @private
 * @param {Object} obj          Object to test and set on.
 * @param {Array} props         Properties to test.
 * @param {Object} defaults     Default values to use.
 */
function _ensureBoolean(obj={}, props=Object.keys(obj), defaults={}) {
  bolt.makeArray(props).forEach(prop=>{
    if (!bolt.isBoolean(obj[prop])) {
      if (defaults.hasOwnProperty(prop)) {
        obj[prop] = defaults[prop];
      } else {
        delete obj[prop];
      }
    }
  });
}

/**
 * Set the access level on BoltDatabaseQueryConfig, uses default if not present.
 *
 * @private
 * @param {BoltDatabaseQueryConfig} queryConfig     Query to set access level on.
 */
function _setAccessLevel(queryConfig) {
  let _level = (queryConfig.accessLevel || defaults.accessLevel).toString().trim().toLowerCase();
  queryConfig.accessLevel = (accessLevels.has(_level)?_level:defaults.accessLevel);
}

module.exports = BoltDatabaseQueryConfig;