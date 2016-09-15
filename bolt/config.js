'use strict';

/**
 * @todo Add windows and mac path?
 */
const configLoadPaths = [boltRootDir + '/server.json', '/etc/bolt/server.json'];
if (process.env.BOLT_CONFIG) configLoadPaths.push(process.env.BOLT_CONFIG + '/server.json');
const requireX = require('require-extra');


function _templateLoop(config) {
  let configText = JSON.stringify(config);
  let configTextOld = '';
  let template = bolt.template(configText);
  while (configText !== configTextOld) {
    config = JSON.parse(template(config));
    configTextOld = configText;
    configText = JSON.stringify(config);
    template = bolt.template(configText);
  }

  return config;
}

function _parseConfig(config) {
  config.script = boltRootDir + '/bolt.js';
  return _templateLoop(config);
}

function loadConfig(name) {
  return requireX.getModule(configLoadPaths)
    .then(config=>bolt.loadMongo(config.db))
    .then(db=>db.collection('configs').findOne({name}))
    .then(_parseConfig)
    .then(siteConfig=>{
      siteConfig.development = (siteConfig.hasOwnProperty('development') ? siteConfig.development : false);
      return siteConfig;
    });
}

module.exports = {
  loadConfig
};
