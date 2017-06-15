#!/usr/bin/env node
'use strict';

Error.stackTraceLimit = Infinity;

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

/**
 * Start the app loading process.
 *
 * @private
 * @param {Object} config   All the config information for the app to load.
 * @returns {Promise}       Promise resolving when app has fully loaded.
 */
function _startApp(config) {
  bolt.hook('afterInitialiseApp', (hook, configPath, app)=>bolt.loadHooks(app));
  return bolt.loadApplication(config);
}


/**
 * Direct app launcher (not using pm2).  Will basically launch the app detailed in the supplied config.
 *
 * @public
 * @param {Object} config   All the config information for the app to launch.
 * @returns {Promise}       Promise resolving when app launched.
 */
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
        return _startApp(config);
      });
    }
    return _startApp(config);
  }
}

/**
 * PM2 app launcher.  Will launch given app using pm2.  The app launching actually, happens when config is sent via a
 * process message and then passed to appLauncher().
 *
 * @public
 * @returns {Promise}   Promise resolving when app launched.
 */
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
