#!/usr/bin/env node
'use strict';

Error.stackTraceLimit = Infinity;

const requireX = _getRequireX();
const bolt = _createPlatformScope();
const packageConfig = requireX.sync('./package.json').config || {};
const ready = _getReady(bolt);

let configDone = false;
let boltLoaded = false;

/**
 * Setup ready callback.
 *
 * @private
 * @returns {Function}      The ready function to fire all on ready events.
 */
function _getReady() {
  const readyCallbacks = new Set();

  bolt.ready = (hook, handler=hook)=>{
    const _handler = ((hook !== handler) ? ()=>bolt.hook(hook, handler) : handler);

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
 * Get and setup requireX
 *
 * @private
 * @returns {requireX}    The requireX module.
 */
function _getRequireX() {
  const { r, g, b, w, c, m, y, k } = [
    ['r', 1], ['g', 2], ['b', 4], ['w', 7],
    ['c', 6], ['m', 5], ['y', 3], ['k', 0]
  ].reduce((cols, col) => ({...cols,  [col[0]]: f => `\x1b[3${col[1]}m${f}\x1b[0m`}), {});

  const requireX = require('require-extra');

  requireX.on('evaluated', event=>{
    const ms = (((event.duration[0] * 1000000000) + event.duration[1]) / 1000000);
    console.log(`${event.cacheSize} ${c(ms+'ms')} ${y(event.target)}`);
  }).on('error', event=>{
    console.log(`Error: ${r(event.target)}\n${r(event.error)}`);
  });

  return requireX;
}

/**
 * Create the bolt object.
 *
 * @private
 * @returns {Object}
 */
function _createBoltObject() {
  return Object.assign(
    {},
    requireX.sync('lodash'),
    requireX.sync('map-watch'), {
      annotation: new (requireX.sync('object-annotations'))()
    }
  );
}

/**
 * Create and setup the scopes used in the platform via require-extra.  Return bolt object.
 *
 * @private
 * @returns {Object}    The bolt object.
 */
function _createPlatformScope() {
  const emptyScope = {};
  const scope = {
    bolt: _createBoltObject(),
    boltRootDir: __dirname,
    colour: requireX.sync('colors'),
    express: requireX.sync('express')
  };

  requireX.set({
    useSandbox:false,
    scope:config=>((config.filename.indexOf('/node_modules/') !== -1) ? emptyScope :scope)
  });

  scope.boltAppID = requireX.sync('./bolt/string').randomString();

  return scope.bolt;
}

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
      await requireX.import('./bolt/', {
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
  await requireX.import('./bolt/', boltImportOptions);
  boltLoaded = true;
  ready();
  const args = await requireX('./cli');

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
