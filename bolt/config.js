'use strict';

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
  config.script = boltRootDir + '/server.js';
  return _templateLoop(config);
}

function loadConfig(name, dbConfig) {
  return bolt.loadMongo(dbConfig)
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
