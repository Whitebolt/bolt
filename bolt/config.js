'use strict';

/**
 * @todo Add windows and mac path?
 */
const configLoadPaths = [boltRootDir + '/server.json', '/etc/bolt/server.json'];
if (process.env.BOLT_CONFIG) configLoadPaths.push(process.env.BOLT_CONFIG + '/server.json');
const Promise = require('bluebird');
const requireX = require('require-extra');
const freeport = Promise.promisify(require("find-free-port"));
const packageConfig = require(boltRootDir + '/package.json').config;
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
  let _value = (value.indexOf(path.delimiter) !== -1 ?
      value.split(path.delimiter).map(value=>value.trim()) :
      value
  );

  _value = (Array.isArray(_value) ? _value.map(_value=>bolt.toBool(_value)) : bolt.toBool(_value));
  _value = (Array.isArray(_value) ? _value.map(_value=>bolt.toTypedNumber(_value)) : bolt.toTypedNumber(_value));
  return _value;
}

/**
 * Parse config, parsing templated values and return the config.
 *
 * @private
 * @param {Object} config   Initial config.
 * @returns {Object}        The parsed config.
 */
function _parseConfig(config) {
  config.script = boltRootDir + '/bolt.js';
  let envConfig = getKeyedEnvVars();
  let dbConfig = bolt.parseTemplatedJson(config);
  let _packageConfig = bolt.getConfig({
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
 * Get configs items from environment variables (BOLT_*).
 *
 * @param {string} [key='BOLT']       The key values to import.
 * @param {Object} [env=process.env]  The environment object to use.
 * @returns {Object}                  The imported values.
 */
function getKeyedEnvVars(key='BOLT', env=process.env) {
  let vars = {};

  Object.keys(env)
    .filter(envKey=>envKey.toLowerCase().startsWith(key.toLowerCase()+'_'))
    .forEach(envKey=>{
      let varKey = bolt.camelCase(envKey.subStr(key.length));
      vars[varKey] = _parseEnvValue(env[envKey]);
    });

  return vars;
}

/**
 * Load global config for app.
 *
 * @param {string} name     The config to load.
 * @returns {Promise}       Promise resolving to the config object.
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
  loadConfig, getKeyedEnvVars
};
