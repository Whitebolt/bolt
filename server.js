#!/usr/bin/env node
'use strict';

Error.stackTraceLimit = Infinity;

let [configDone, boltLoaded] = [false, false];

const eventsStack = [];
const requireX = _getRequireX();
const bolt = _createPlatformScope();
const packageConfig = requireX.sync('./package.json').config || {};
const ready = _getReady(bolt);
const path = require('path');


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

bolt.ready(()=>{
  bolt.ModuleSetScopeEvent = class ModuleSetScopeEvent extends bolt.Event {};
  bolt.ModuleEvaluateEvent = class ModuleEvaluateEvent extends bolt.Event {};
});

/**
 * Get and setup requireX
 *
 * @private
 * @returns {requireX}    The requireX module.
 */
function _getRequireX() {
  const requireX = require('require-extra');

  function moduleLoaded(event) {
    bolt.emit('loadedModule', event.target, (((event.duration[0] * 1000000000) + event.duration[1]) / 1000000));
  }

  function getEmitFunction(event) {
    return !!event.sync?bolt.emitSync:bolt.emit;
  }

  function evaluate(eventName, event) {
    return getEmitFunction(event)(eventName, new bolt.ModuleEvaluateEvent({
      type:eventName,
      target:event.target,
      source:event.source,
      config: event.moduleConfig,
      parserOptions: event.parserOptions,
      data: event.data,
      scope: event.moduleConfig.scope,
      sync: event.sync
    }));
  }

  function setScope(eventName, event) {
    return getEmitFunction(event)(eventName, new bolt.ModuleSetScopeEvent({
      type:eventName,
      target:event.target,
      source:event.source,
      scope: event.moduleConfig.scope,
      sync: event.sync
    }));
  }

  requireX.on('evaluate', event=>{
    if (boltLoaded) {
      const ext = path.extname(event.target);
      if (ext.charAt(0) === '.') {
        event.moduleConfig.scope = event.moduleConfig.scope || {};
        return bolt.runSeries(!event.sync, [
          ()=>setScope(bolt.camelCase(`moduleSetScope_${ext.substring(1)}`), event),
          ()=>evaluate(bolt.camelCase(`moduleEvaluate_${ext.substring(1)}`), event)
        ]);
      }
    }
  });

  requireX.on('evaluated', event=>{
    if (boltLoaded) {
      while (eventsStack.length) moduleLoaded(eventsStack.pop());
      moduleLoaded(event);
    } else {
      eventsStack.push(event);
    }
  }).on('error', error=>{
    console.log(error);
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
  const scope = {
    bolt: _createBoltObject(),
    boltRootDir: __dirname,
    express: requireX.sync('express')
  };

  requireX.on('evaluate', event=>{
    if (event.moduleConfig.filename.indexOf('/node_modules/') === -1) event.moduleConfig.scope = scope;
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
