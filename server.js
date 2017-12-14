#!/usr/bin/env node
'use strict';

Error.stackTraceLimit = Infinity;

let [configDone, boltLoaded] = [false, false];

const path = require('path');
const bolt = {require: require('require-extra')};
const ready = require('./lib/ready')(bolt, ()=>boltLoaded);
require('./lib/requirex')(bolt, ()=>boltLoaded);
require('./lib/platformScope')(bolt, __dirname);
const packageConfig = bolt.require.sync('./package.json').config || {};

const xUseStrict = /["']use strict["'](?:\;|)/;


global.startTime = process.hrtime();


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
      const boltLookup = new Map();
      const boltDir = path.resolve(__dirname, './bolt');
      const evaluateListener = onBoltEvaluate.bind(undefined, boltDir, boltLookup);
      bolt.require.on('evaluate', evaluateListener);

      await bolt.require.import('./bolt/', {
        merge: true,
        imports: bolt,
        excludes: packageConfig.appLaunchExcludes,
        basedir: __dirname,
        parent: __filename,
        onload: (modulePath, exports)=>{
          if (boltLookup.has(modulePath)) {
            bolt.annotation.from(boltLookup.get(modulePath), exports);
            bolt.annotation.set(exports, 'modulePath', modulePath);
            bolt.__modules.add(exports);
          }
        }
      });

      boltLoaded = true;
      bolt.require.removeListener(evaluateListener);
      ready();
    }

    return _startApp(config);
  }
}

function moduleWrapForAnnotations(content) {
  return 'function(){'+content.replace(xUseStrict,'')+'}';
}

function onBoltEvaluate(boltDir, boltLookup, event) {
  if (event.target.indexOf(boltDir) === 0) {
    const content = event.moduleConfig.content.toString();
    boltLookup.set(event.target, moduleWrapForAnnotations(content));
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
  const boltLookup = new Map();

  let boltImportOptions = {
    merge:true,
    imports:bolt,
    basedir:__dirname,
    parent: __filename,
    onload: (modulePath, exports)=>{
      if (boltLookup.has(modulePath)) {
        bolt.annotation.from(boltLookup.get(modulePath), exports);
        bolt.annotation.set(exports, 'modulePath', modulePath);
        bolt.__modules.add(exports);
      }
    }
  };
  if (process.getuid && process.getuid() === 0) boltImportOptions.includes = packageConfig.pm2LaunchIncludes;

  const boltDir = path.resolve(__dirname, './bolt');
  const evaluateListener = onBoltEvaluate.bind(undefined, boltDir, boltLookup);
  bolt.require.on('evaluate', evaluateListener);

  await bolt.require.import('./bolt/', boltImportOptions);
  boltLoaded = true;
  bolt.require.removeListener('evaluate', evaluateListener);
  ready();
  const args = await bolt.require('./cli');

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
