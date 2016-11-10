'use strict';

/**
 * @module bolt/bolt
 * @todo Add windows and mac path?
 */
const configLoadPaths = [boltRootDir + '/server.json', '/etc/bolt/server.json'];
if (process.env.BOLT_CONFIG) configLoadPaths.push(process.env.BOLT_CONFIG + '/server.json');
const Promise = require('bluebird');
const requireX = require('require-extra');
const freeport = Promise.promisify(require("find-free-port"));
const packageData = require(boltRootDir + '/package.json');
const packageConfig = packageData.config || {};
const path = require('path');


/**
 * Parse the environment variable value into arrays and types (float,
 * integer and boolean).
 *
 * @private
 * @param {string} value    Value to parse.
 * @returns {Array|*}       Parsed value.
 */
function _parseEnvValue(value) {
  [_parseEnvArray, bolt.toBool, bolt.toTypedNumber].forEach(converter=>{
    value = _parseEnvValueConvert(value, converter);
  });

  return value;
}

function _parseEnvArray(value) {
  return (value.indexOf(path.delimiter) !== -1 ?
      value.split(path.delimiter).map(value=>value.trim()) :
      value
  );
}

function _parseEnvValueConvert(value, converter) {
  return (Array.isArray(value) ? value.map(value=>_parseEnvValueConvertItem(value, converter)) : _parseEnvValueConvertItem(value, converter));
}

function _parseEnvValueConvertItem(value, converter) {
  let converted = converter(value);
  return ((converted !== value) ? converted :value);
}


/**
 * Parse config, parsing templated values and return the config.
 *
 * @private
 * @param {Object} config   Initial config.
 * @returns {Object}        The parsed config.
 */
function _parseConfig(config) {
  config.script = boltRootDir + '/server.js';
  let envConfig = getKeyedEnvVars();
  let dbConfig = bolt.parseTemplatedJson(config);
  let _packageConfig = _getConfig({
    root: bolt.uniq((dbConfig.root || []).concat(envConfig.root || []).concat(packageConfig.root || []))
  });

  return bolt.merge(_packageConfig, envConfig, dbConfig);
}

/**
 * Assign a new port according to config options.
 *
 * @private
 * @param {Object} config   The config object.
 * @returns {Object}        The config with port assigned.
 */
function _assignPort(config) {
  if (config.assignFreePort) {
    return freeport(config.portRange.start, config.portRange.end).then(portNo=>{
      config.devPort = config.port;
      config.port = portNo;
      return config;
    })
  }

  return config;
}

/**
 *
 * @private
 * @param {Array|string} roots  Get configs from the various package.json roots.
 * @returns {Array}             Array of config objects.
 */
function _getPackageConfigs(roots, configProp='config') {
  return bolt.makeArray(roots || []).map(root=>{
    let packageData = _getPackage(root);
    return packageData[configProp] || {};
  });
}

function _getPackage(root) {
  try {
    return require(root+'package.json');
  } catch(e) {return {};}
}

const _configMergeOverrides = {
  /**
   * Merge eventConsoleLogging arrays together avoid duplicates and merging of
   * the actual objects (default lodash action).
   *
   * @param {Array} objValue    The value being merged into.
   * @param {Array} srcValue    The value to merge in.
   * @returns {Array}           The merged value.
   */
  eventConsoleLogging: (objValue, srcValue)=>{
    let lookup = {};
    return (objValue || []).concat(srcValue || []).reverse().filter(item=>{
      if (!lookup[item.event]) {
        lookup[item.event] = true;
        return true;
      }
      return false;
    }).reverse();
  }
};

/**
 * Generate a function to to merge the configs together. The default lodash
 * merge is used, unless an override is supplied via _configMergeOverrides.
 *
 * @private
 * @param {*} objValue    The value being merged into.
 * @param {*} srcValue    The value to merge in.
 * @param {string} key    The object property we are merging.
 * @returns {undefined|*} The new value after merging or undefined to use
 *                        default method.
 */
function _configMerge(objValue, srcValue, key) {
  return (_configMergeOverrides.hasOwnProperty(key) ?
      _configMergeOverrides[key](objValue, srcValue) :
      undefined
  );
}

/**
 * Get a config object from package.json and the supplied config.
 *
 * @private
 * @param {Object} config   Config object to act as the last merge item.
 * @returns {Object}        The new constructed config with default available.
 */
function _getConfig(config) {
  let packageConfigs = _getPackageConfigs(config.root);
  packageConfigs.unshift({
    version: packageData.version,
    name: packageData.name,
    description: packageData.description,
    template: 'index'
  });
  packageConfigs.push(config, _configMerge);

  return bolt.mergeWith.apply(bolt, packageConfigs);
}

/**
 * Get configs items from environment variables (BOLT_*).
 *
 * @public
 * @param {string} [key='BOLT']       The key values to import.
 * @param {Object} [env=process.env]  The environment object to use.
 * @returns {Object}                  The imported values.
 */
function getKeyedEnvVars(key=packageConfig.boltEnvPrefix, env=process.env) {
  let vars = {};

  Object.keys(env)
    .filter(envKey=>envKey.toLowerCase().startsWith(key.toLowerCase()+'_'))
    .forEach(envKey=>{
      let varKey = bolt.camelCase(envKey.substr(key.length));
      vars[varKey] = _parseEnvValue(env[envKey]);
    });

  return vars;
}

function mergePackageConfigs(roots, merger=()=>{}, configProp='config') {
  let _configProp = bolt.isString(merger)?merger:configProp;
  let _merger = bolt.isFunction(merger)?merger:()=>{};
  return bolt.get(mergePackageProperties(roots, _configProp, _merger), _configProp) || {};
}

function mergePackageProperties(roots, properties=[], merger=()=>{}) {
  const packageConfigs = bolt.makeArray(roots).map(root=>
    bolt.pickDeep(_getPackage(root), bolt.makeArray(properties))
  );
  packageConfigs.unshift({});
  if (bolt.isFunction(merger)) packageConfigs.push(_configMerge);
  return bolt.mergeWith.apply(bolt, packageConfigs);
}

/**
 * @typedef boltConfig
 * Configuration object for bolt-server.
 *
 * @property {integer} [port]                       Network port to attach app to.
 * @property {string|Array} root                    The directory roots to load server from.
 * @property {string} accessLog                     Location to write access log to.
 * @property {string|Array.<string>} [template]     Named template(s) to apply.
 * @property {Array.<boltConfigDb>} [databases]     Databases to load.
 * @property {string} secret                        Cookie encryption string.
 * @property {boolean} [development]                Run in development mode or not?
 * @property {Array.<Object>} [proxy]               Define any proxies.
 * @property {Array.<Object>} [eventConsoleLogging] Event logging options.
 * @property {integer} [logLevel]                   Log level to run at (0-8).
 */

/**
 * @typedef boltConfigDb
 * @property {string} type                    Connection type (eg. mongodb,
 *                                            mysql, ...etc).
 * @property {string} [server='localhost']    Server hostname
 * @property {integer} [port]                 Port no.
 * @property {string} database                Database name.
 * @property {string} [username]              Username to connect as.
 * @property {string} [password]              Password to use.
 * @property {string} [adminDatabase='admin'] Admin database t use (mongo specfic).
 */

/**
 * Load global config for app.
 *
 * @public
 * @static
 * @param {string} name           The config to load.
 * @returns {Promise<boltConfig>} Promise resolving to the config object.
 */
function loadConfig(name) {
  return requireX.getModule(true, configLoadPaths)
    .then(config=>bolt.loadMongo(config.db))
    .then(db=>db.collection('configs').findOne({name}))
    .then(_parseConfig)
    .then(_assignPort)
    .then(siteConfig=>{
      siteConfig.development = (siteConfig.hasOwnProperty('development') ? siteConfig.development : false);
      return siteConfig;
    });
}

module.exports = {
  loadConfig, getKeyedEnvVars, mergePackageConfigs, mergePackageProperties
};
