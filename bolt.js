#!/usr/bin/env node
'use strict';

global.boltRootDir = __dirname;
global.colour = require('colors');
global.express = require('express');
global.bolt = require('lodash');

let configDone = false;
process.on('message', message=>{
  if (message.type === 'config') appLauncher(message.data);
});

function appLauncher(config) {
  if (!configDone) {
    configDone = true;
    return require('require-extra').importDirectory('./bolt/', {
      merge: true,
      imports: bolt
    }).then(bolt => {
      bolt.hook('afterInitialiseApp', (hook, configPath, app) => bolt.loadHooks(app));
      bolt.loadApplication(config);
    });
  }
}

function pm2Controller() {
  /**
   * @todo Add a filter here do not need entire object.
   */
  return require('require-extra')
    .importDirectory('./bolt/', {merge: true, imports: bolt})
    .then(()=>require('./cli'))
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
