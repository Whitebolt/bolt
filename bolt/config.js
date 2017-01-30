'use strict';

/**
 * @module bolt/bolt
 * @todo Add windows and mac path?
 */
const Promise = require('bluebird');
const requireX = require('require-extra');
const freeport = Promise.promisify(require("find-free-port"));
const path = require('path');

const packageData = getPackage(boltRootDir);
const packageConfig = packageData.config || {};
const env = getKeyedEnvVars();
const configLoadPaths = getConfigLoadPaths();


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

/**
 * Take an environment variable string and convert arrays into arrays,.
 *
 * @private
 * @param {string} value      Value to convert.
 * @returns {string|array}    New array or original string.
 */
function _parseEnvArray(value) {
  return (value.indexOf(path.delimiter) !== -1 ?
      value.split(path.delimiter).map(value=>value.trim()) :
      value
  );
}

/**
 * Convert given environment variable using the given convertor function. Will accept arrays, converting each item.
 *
 * @private
 * @param {Array|*} value         Value to convert.
 * @param {Function} converter    Converter function.
 * @returns {*}                   Converted value.
 */
function _parseEnvValueConvert(value, converter) {
  return (Array.isArray(value) ? value.map(value=>_parseEnvValueConvertItem(value, converter)) : _parseEnvValueConvertItem(value, converter));
}

/**
 * Convert given environment variable using the given converter function. Will not accept arrays.
 *
 * @private
 * @param {*} value               Value to convert.
 * @param {Function} converter    Converter function.
 * @returns {*}                   Converted value.
 */
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
  let dbConfig = bolt.parseTemplatedJson(config);
  let root = _concatPropertyArray([dbConfig, env, packageConfig], 'root');
  return bolt.mergeWith(_getConfig({root}), env, dbConfig, _configMerge);
}

/**
 * Take an array of objects and return the given property from (assuming an array) and merge together.
 *
 * @private
 * @param {Object[]} objects    Objects to get property from.
 * @param {string} property     Property to get.
 * @returns {Array}             Merged array.
 */
function _concatPropertyArray(objects, property) {
  return bolt.uniq(bolt.flatten(objects.map(_property=>_property[property] || [])));
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
  let packageConfigs = [];
  packageConfigs.push(bolt.pickDeep(packageData, ['version', 'name', 'description']));
  packageConfigs.push({template:'index'});
  packageConfigs.push(bolt.pick(packageData.config, packageData.config.boltConfigProperties || []));
  packageConfigs.push(mergePackageConfigs(config.root, _configMerge));
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
 * Load config from default locations.
 *
 * @private
 * @returns {Object}    The config object.
 */
function getConfigLoadPaths() {
  const serverConfigFile = (env.serverConfigFile || packageConfig.serverConfigFile);
  const configLoadPaths = [boltRootDir + '/' + serverConfigFile];
  if (env.hasOwnProperty('config')) bolt.makeArray(env.config).forEach(config=>configLoadPaths.push(config + '/' + serverConfigFile));
  if (packageConfig.serverConfigPath) configLoadPaths.push(packageConfig.serverConfigPath + '/' + serverConfigFile);
  return bolt.flattenDeep(configLoadPaths);
}

/**
 * Get the package file in the given directory (or return empty object).
 *
 * @private
 * @param {string} dirPath    Path to load from.
 * @returns {Object}          The package object.
 */
function getPackage(dirPath=boltRootDir) {
  try {
    return require(dirPath + '/package.json');
  } catch(e) {return {};}
}

/**
 * Grab package.json files and get the specfied properties merging them all together.
 *
 * @public
 *  @param {string[]|string} roots              The directories to load from.
 * @param {Array|string} [properties=[]]        Properties to grab.
 * @param {Function} [merger=()=>{}]            Merger function to use.
 * @returns {Object}                            Merged object with selected properties.
 */
function mergePackageProperties(roots, properties=[], merger=()=>{}) {
  const packageConfigs = bolt.makeArray(roots).map(root=>
    bolt.pickDeep(getPackage(root), bolt.makeArray(properties))
  );
  packageConfigs.unshift({});
  if (bolt.isFunction(merger)) packageConfigs.push(_configMerge);
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
function getKeyedEnvVars(key=packageConfig.boltEnvPrefix || 'BOLT', env=process.env) {
  let vars = {};
  Object.keys(env)
    .filter(envKey=>envKey.toLowerCase().startsWith(key.toLowerCase()+'_'))
    .forEach(envKey=>{
      let varKey = bolt.camelCase(envKey.substr(key.length));
      vars[varKey] = _parseEnvValue(env[envKey]);
    });

  return vars;
}

/**
 * Grab package.json files and get the config properties merging them all together.
 *
 * @public
 * @param {string[]|string} roots             The directories to load from.
 * @param {Function|string} [merger=()=>{}]   Merger function to use or configProp (if a string).
 * @param {string} [configProp='config]       The property to get from.
 * @returns {Object}                          The merged package.
 */
function mergePackageConfigs(roots, merger=()=>{}, configProp='config') {
  let _configProp = bolt.isString(merger)?merger:configProp;
  let _merger = bolt.isFunction(merger)?merger:()=>{};
  return bolt.get(mergePackageProperties(roots, _configProp, _merger), _configProp) || {};
}

/**
 * Load global config for app.
 *
 * @public
 * @static
 * @param {string} name           The config to load.
 * @returns {Promise<boltConfig>} Promise resolving to the config object.
 */
function loadConfig(name, profile) {
  return requireX.getModule(true, configLoadPaths)
    .then(config=>bolt.loadMongo(config.db))
    .then(db=>{
      return db.collection('apps')
        .findOne({name})
        .then(_parseConfig)
        .then(config=>{
          if (!profile) profile = (config.development ? 'development' : 'production');
          return db.collection('profiles').findOne({name:profile}).then(profileConfig=>{
            if (profileConfig) {
              delete profileConfig.name;
              return bolt.mergeWith(config, profileConfig, _configMerge);
            }
          });
        });
    })
    .then(_assignPort)
    .then(siteConfig=>{
      siteConfig.development = (siteConfig.hasOwnProperty('development') ? siteConfig.development : false);
      return siteConfig;
    });
}

module.exports = {
  loadConfig, getKeyedEnvVars, mergePackageConfigs, mergePackageProperties, getConfigLoadPaths, getPackage
};
