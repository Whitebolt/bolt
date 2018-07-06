#!/usr/bin/env node
'use strict';

Error.stackTraceLimit = Infinity;

let [configDone, boltLoaded] = [false, false];

const path = require('path');
const fs = require('fs');
global.__originalCwd = process.cwd();
process.chdir(path.dirname(fs.realpathSync(__filename)));
const requireX = require('require-extra');
requireX.set('followHardLinks', true);
requireX.set('useCache', true);
const bolt = requireX.sync("lodash").runInContext();
bolt.require = require('require-extra');
bolt.annotation =  new (bolt.require.sync('@simpo/object-annotations'))();
const packageConfig = bolt.require.sync('./package.json').config || {};
const ready = require('./lib/ready')(bolt, ()=>boltLoaded);
require('./lib/requirex')(bolt, ()=>boltLoaded);
require('./lib/platformScope')(bolt, __dirname);


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

		requireX.set('roots', config.root);

		if (!boltLoaded) {
			await bolt.require.import('./bolt/', {
				merge: true,
				imports: bolt,
				retry: true,
				excludes: packageConfig.appLaunchExcludes,
				basedir: __dirname,
				parent: __filename,
				onload: bolt.boltOnLoad,
				onerror: error=>{
					console.log('Failed to load bolt module: ', error.source);
					console.error(error.error);
				}
			});

			boltLoaded = true;
			ready();
		}

		return _startApp(config);
	}
}

bolt.boltOnLoad = function boltOnLoad(modulePath, exports) {
	if (bolt.isObject(exports)) {
		bolt.functions(exports).forEach(methodName=>{
			bolt.annotation.from(exports[methodName].toString(), exports[methodName]);
		});
	}

	if (!('__modules' in bolt)) bolt.__modules = new Set();
	return bolt.__modules.add(modulePath);
};

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
		retry: true,
		basedir:__dirname,
		parent: __filename,
		onload: bolt.boltOnLoad,
		onerror: error=>{
			console.log('Failed to load bolt module: ', error.source);
			console.error(error.error);
		}
	};
	if (process.getuid && process.getuid() === 0) boltImportOptions.includes = packageConfig.pm2LaunchIncludes;

	await bolt.require.import('./bolt/', boltImportOptions);
	boltLoaded = true;
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
