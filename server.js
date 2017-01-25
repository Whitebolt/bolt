#!/usr/bin/env node
'use strict';

global.boltRootDir = __dirname;
global.colour = require('colors');
global.express = require('express');
global.bolt = require('lodash');
global.boltAppID = require('./bolt/string').randomString();

const packageConfig = require('./package.json').config || {};

let configDone = false;
let boltLoaded = false;


process.on('message', message=>{
  if (message.type === 'config') appLauncher(message.data);
});

function startApp(config) {
//console.log(config);
  bolt.hook('afterInitialiseApp', (hook, configPath, app) => bolt.loadHooks(app));
  return bolt.loadApplication(config);
}

function appLauncher(config) {
  if (!configDone) {
    configDone = true;
    if (!boltLoaded) {
      return require('require-extra').importDirectory('./bolt/', {
        merge: true,
        imports: bolt,
        excludes: packageConfig.appLaunchExcludes,
        useSyncRequire: true
      }).then(()=>{
        boltLoaded = true;
        return startApp(config);
      });
    }
    return startApp(config);
  }
}

function pm2Controller() {
  let boltImportOptions = {merge:true, imports:bolt, useSyncRequire:true};
  if (process.getuid && process.getuid() === 0) boltImportOptions.includes = packageConfig.pm2LaunchIncludes;

  return require('require-extra')
    .importDirectory('./bolt/', boltImportOptions)
    .then(()=>{
      boltLoaded = true;
      return require('./cli')
    })
    .then(args=>{
      return Promise.all(args._.map(cmd=>{
        if (args.cmd.hasOwnProperty(cmd)) {
          return args.cmd[cmd](args);
        }
      }));
    });
}

if (!module.parent) pm2Controller();

module.exports = appLauncher;
