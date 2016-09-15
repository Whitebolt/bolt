#!/usr/bin/env node
'use strict';

global.boltRootDir = __dirname;
global.colour = require('colors');
global.express = require('express');
global.bolt = require('lodash');

const Promise = require('bluebird');
const pm2 = require('bluebird').promisifyAll(require('pm2'));
let linuxUser;
try {linuxUser = require('linux-user');} catch (err) {}
const chown = Promise.promisify(require('chownr'));
const launcher = require('./server');

const config = require('/etc/bolt/server.json');
const processFileProperties = Object.keys(require('pm2/lib/CLI/schema.json'));
const boltConfigProperties = ['port', 'root', 'accessLog', 'template', 'databases', 'secret', 'development', 'proxy'];

const argv = require('yargs')
  .command('start <name>', 'Start the server process.')
  .argv;

if (!argv.development && argv.d) argv.development = argv.d;
if (!argv.development && !argv.d) argv.development = false;


function getPm2Instances(name) {
  return pm2.listAsync()
    .filter(apps=>(apps.name === name));
}

function removeOldInstances(pm2Config) {
  return getPm2Instances(pm2Config.name).then(apps=>(
    apps.length ?
      Promise.all(apps.map(app=>pm2.deleteAsync(app.pm2_env.pm_id))) :
      true
  ));
}

function startInstance(pm2Config, boltConfig) {
  return pm2.startAsync(pm2Config).then(app=>{
    const id = app[0].pm2_env.pm_id;
    pm2.sendDataToProcessId(id, {type:'config', data:boltConfig, id, topic:'config'});
    return pm2.disconnectAsync().then(()=>app[0]);
  });
}

function launchPm2(siteConfig) {
  let pm2Config = bolt.pick(siteConfig, processFileProperties);
  let boltConfig = bolt.pick(siteConfig, boltConfigProperties);

  return pm2.connectAsync()
    .then(()=>removeOldInstances(pm2Config))
    .then(()=>startInstance(pm2Config, boltConfig));
}

function launchApp(siteConfig) {
  let boltConfig = bolt.pick(siteConfig, boltConfigProperties);
  launcher(boltConfig);
}

function createUserIfNotCreated(isUser, siteConfig) {
  if (!isUser) {
    var options = {username: siteConfig.userName};
    if (siteConfig.homeDir) options.d = siteConfig.homeDir;
    return linuxUser.addUser(options)
      .then(result=>linuxUser.getUserInfo(siteConfig.userName));
  }
  return true;
}

function addUser(siteConfig) {
  if (siteConfig.userName) {
    return linuxUser.isUser(siteConfig.userName).then(
      isUser=>createUserIfNotCreated(isUser, siteConfig)
    ).then(
      isUser=>linuxUser.getUserInfo(siteConfig.userName)
    ).then(user=>{
      return chown(user.homedir, user.uid, user.gid).then(
        result=>user
      );
    }).then(user=>{
      siteConfig.uid = user.uid;
      siteConfig.gid = user.gid;
      return siteConfig;
    });
  } else {
    return siteConfig;
  }
}

/**
 * @todo Add a filter here do not need entire object.
 */
return require('require-extra').importDirectory('./bolt/', {
  merge: true,
  imports: bolt
}).then(()=>{
  if (bolt.indexOf(argv._, 'start') !== -1) {
    if (argv.hasOwnProperty('name')) {
      bolt.loadConfig(argv.name, config.db).then(siteConfig=>{
        if (!linuxUser) siteConfig.development = true;
        if (argv.development) siteConfig.development = true;
        return siteConfig;
      }).then(
        siteConfig=>((!siteConfig.development) ? addUser(siteConfig) : siteConfig)
      ).then(
        siteConfig=>((!siteConfig.development) ? launchPm2(siteConfig) : launchApp(siteConfig)),
        err=>console.log(err)
      ).then(app=>{
        if (app && app.pm2_env) {
          console.log(app.pm2_env.name, 'launched with id:', app.pm2_env.pm_id);
          process.exit();
        }
      });
    }
  }
});
