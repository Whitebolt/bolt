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

function getKeyedEnvVars(key, env=process.env) {
  let vars = {};

  object.keys(env)
    .filter(envKey=>envKey.toLowerCase().startsWith(key.toLowerCase()+'_'))
    .forEach(envKey=>{
      let varKey = bolt.camelCase(envKey.subStr(key.length));
      vars[varKey] = env[envKey];
    });

  return vars;
}


function _parseConfig(config) {
  config.script = boltRootDir + '/bolt.js';
  return bolt.merge(packageConfig, bolt.parseTemplatedJson(config));
}

function assignPort(config) {
  if (config.assignFreePort) {
    return freeport(config.portRange.start, config.portRange.end).then(portNo=>{
      config.devPort = config.port;
      config.port = portNo;
      return config;
    })
  }

  return config;
}

function loadConfig(name) {
  return requireX.getModule(true, configLoadPaths)
    .then(config=>bolt.loadMongo(config.db))
    .then(db=>db.collection('configs').findOne({name}))
    .then(_parseConfig)
    .then(assignPort)
    .then(siteConfig=>{
      siteConfig.development = (siteConfig.hasOwnProperty('development') ? siteConfig.development : false);
      return siteConfig;
    });
}

module.exports = {
  loadConfig, getKeyedEnvVars
};
