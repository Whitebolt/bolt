'use strict';

const pm2 = require('bluebird').promisifyAll(require('pm2'));
const processFileProperties = Object.keys(require('pm2/lib/CLI/schema.json'));
const boltConfigProperties = require(boltRootDir + '/package.json').config.boltConfigProperties;


function _removeOldInstances(pm2Config) {
  return _getPm2Instances(pm2Config.name).then(apps=>(
    apps.length ?
      Promise.all(apps.map(app=>pm2.deleteAsync(app.pm2_env.pm_id))) :
      true
  ));
}

function _getPm2Instances(name) {
  return pm2.listAsync()
    .filter(apps=>(apps.name === name));
}

function _startInstance(pm2Config, boltConfig) {
  return pm2.startAsync(pm2Config).then(app=>{
    const id = app[0].pm2_env.pm_id;
    pm2.sendDataToProcessId(id, {type:'config', data:boltConfig, id, topic:'config'});
    return pm2.disconnectAsync().then(()=>app[0]);
  });
}

function pm2LaunchApp(siteConfig) {
  let pm2Config = bolt.pick(siteConfig, processFileProperties);
  let boltConfig = bolt.pick(siteConfig, boltConfigProperties);

  return pm2.connectAsync()
    .then(()=>_removeOldInstances(pm2Config))
    .then(()=>_startInstance(pm2Config, boltConfig));
}

module.exports = {
  pm2LaunchApp
};