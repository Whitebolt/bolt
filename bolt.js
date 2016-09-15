#!/usr/bin/env node
'use strict';

global.boltRootDir = __dirname;
global.colour = require('colors');
global.express = require('express');
global.bolt = require('lodash');

const Promise = require('bluebird');
let linuxUser;
try {linuxUser = require('linux-user');} catch (err) {}
const chown = Promise.promisify(require('chownr'));
const launcher = require('./server');



const argv = require('yargs')
  .command('start <name>', 'Start the server process.')
  .argv;

if (!argv.development && argv.d) argv.development = argv.d;
if (!argv.development && !argv.d) argv.development = false;


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
      bolt.loadConfig(argv.name).then(siteConfig=>{
        if (!linuxUser) siteConfig.development = true;
        if (argv.development) siteConfig.development = true;
        return siteConfig;
      }).then(
        siteConfig=>((!siteConfig.development) ? addUser(siteConfig) : siteConfig)
      ).then(
        siteConfig=>((!siteConfig.development) ? bolt.pm2LaunchApp(siteConfig) : launchApp(siteConfig)),
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
