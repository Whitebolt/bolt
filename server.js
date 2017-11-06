#!/usr/bin/env node
'use strict';

Error.stackTraceLimit = Infinity;

const readyCallbacks = new Set();
const requireX = require('require-extra');
const { r, g, b, w, c, m, y, k } = [
  ['r', 1], ['g', 2], ['b', 4], ['w', 7],
  ['c', 6], ['m', 5], ['y', 3], ['k', 0]
].reduce((cols, col) => ({
  ...cols,  [col[0]]: f => `\x1b[3${col[1]}m${f}\x1b[0m`
}), {});

global.boltRootDir = __dirname;
global.colour = require('colors');
global.express = require('express');
global.bolt = require('lodash');
global.boltAppID = require('./bolt/string').randomString();

requireX.on('evaluated', event=>{
  const ms = (((event.duration[0] * 1000000000) + event.duration[1]) / 1000000);
  console.log(`${event.cacheSize} ${c(ms+'ms')} ${y(event.target)}`);
});

requireX.on('error', event=>{
  console.log(`Error: ${r(event.target)}
  ${r(event.error)}`);
});

//requireX.set('useSyncRequire', true);
requireX.set('useSandbox', false);

Object.assign(
  global.bolt,
  require('map-watch'), {
    annotation: new (require('object-annotations'))()
  }
);

const packageConfig = require('./package.json').config || {};

let configDone = false;
let boltLoaded = false;

global.bolt.ready = (hook, handler=hook)=>{
  const _handler = ((hook !== handler) ? ()=>bolt.hook(hook, handler) : handler);

  if (!boltLoaded) {
    readyCallbacks.add(_handler);
    return ()=>readyCallbacks.delete(_handler);
  } else {
    _handler();
    return ()=>{};
  }
};

function ready() {
  readyCallbacks.forEach(handler=>handler());
  readyCallbacks.clear();
}

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
async function appLauncher(config) {
  if (!configDone) {
    configDone = true;
    if (!boltLoaded) {
      await require('require-extra').import('./bolt/', {
        merge: true,
        imports: bolt,
        excludes: packageConfig.appLaunchExcludes,
        basedir: __dirname,
        parent: __filename
      });

      boltLoaded = true;
      ready();
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
async function pm2Controller() {
  let boltImportOptions = {
    merge:true,
    imports:bolt,
    basedir:__dirname,
    parent: __filename
  };
  if (process.getuid && process.getuid() === 0) boltImportOptions.includes = packageConfig.pm2LaunchIncludes;
  await require('require-extra').import('./bolt/', boltImportOptions);
  boltLoaded = true;
  ready();
  const args = await require('./cli');

  return Promise.all(args._.map(cmd=>{
    if (args.cmd.hasOwnProperty(cmd)) return args.cmd[cmd](args);
  }));
}

if (!module.parent) pm2Controller();

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at: Promise', promise, 'reason:', reason);
});

module.exports = appLauncher;
