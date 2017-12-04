#!/usr/bin/env node
'use strict';

Error.stackTraceLimit = Infinity;

let [configDone, boltLoaded] = [false, false];

const bolt = {requireX: require('require-extra')};
const ready = _getReady();
require('./lib/requirex')(bolt, ()=>boltLoaded);
require('./lib/platformScope')(bolt, __dirname);
const packageConfig = bolt.requireX.sync('./package.json').config || {};


global.startTime = process.hrtime();

/**
 * Setup ready callback.
 *
 * @private
 * @returns {Function}      The ready function to fire all on ready events.
 */
function _getReady() {
  const readyCallbacks = new Set();

  bolt.ready = (hook, handler=hook)=>{
    const _handler = ((hook !== handler) ? ()=>bolt.emit(hook, handler) : handler);

    if (!boltLoaded) {
      readyCallbacks.add(_handler);
      return ()=>readyCallbacks.delete(_handler);
    } else {
      _handler();
      return ()=>{};
    }
  };

  return ()=>{
    readyCallbacks.forEach(handler=>handler());
    readyCallbacks.clear();
  }
}

/**
 * Start the app loading process.
 *
 * @private
 * @param {Object} config   All the config information for the app to load.
 * @returns {Promise}       Promise resolving when app has fully loaded.
 */
function _startApp(config) {
  bolt.after('initialiseApp', (configPath, app)=>bolt.loadHooks(app));
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
      await bolt.requireX.import('./bolt/', {
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
  await bolt.requireX.import('./bolt/', boltImportOptions);
  boltLoaded = true;
  ready();
  const args = await bolt.requireX('./cli');

  return Promise.all(args._.map(cmd=>{
    if (args.cmd.hasOwnProperty(cmd)) return args.cmd[cmd](args);
  }));
}

process.on('message', message=>{
  if (message.type === 'config') appLauncher(message.data);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at: Promise', promise, 'reason:', reason);
});

if (!module.parent) pm2Controller();
module.exports = appLauncher;
