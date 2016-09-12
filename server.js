'use strict';

global.boltRootDir = __dirname;
global.colour = require('colors');
global.express = require('express');
global.bolt = require('lodash');

let configDone = false;

process.on('message', message=>{
  if (message.type === 'config') launcher(message.data);
});

function launcher(config) {
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

module.exports = launcher;
