#!/usr/bin/env node
'use strict';

const xSpaces = /\s+/;
let [configDone, boltLoaded] = [false, false];

const path = require('path');
const {loadBoltModule, loadLibModule, loadBoltModules} = require('./lib/loaders');
const bolt = _init();


function _init() {
	Error.stackTraceLimit = Infinity;
	Object.assign(global, {__originalCwd:process.cwd(), startTime:process.hrtime()});
	process.chdir(path.dirname(require('fs').realpathSync(__filename)));
	return _getBolt();
}

function _getBolt() {
	const {provideBolt} = require('./lib/loaders');
	const requireX = require('require-extra')
		.set('followHardLinks', true)
		.set('useCache', true);

	const bolt = Object.assign(
		requireX.sync("lodash").runInContext(),
		{
			require: requireX,
			annotation: new (requireX.sync('@simpo/object-annotations'))(),
			__paths: new Set([__dirname])
		}
	);

	provideBolt(bolt);
	_initLoader(bolt);

	return bolt;
}

function _initLoader(bolt) {
	bolt.annotation.addParser(value=>{
		// @annotation key zone
		return new Set([...value.split(xSpaces).map(zone=>zone.trim())]);
	});

	const {createPlatformScope, boltRequireXLoader} = loadLibModule(['platformScope', 'requirex']);
	createPlatformScope(bolt, __dirname, [loadBoltModule, loadLibModule]);
	Object.assign(bolt, loadBoltModule('event'));
	bolt.BoltModuleReadyEvent = class BoltModuleReadyEvent extends bolt.Event {};
	boltRequireXLoader(bolt, ()=>boltLoaded);

	return bolt;
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

async function _loadBoltModules(loadPath, boltImportOptions, allowedZones) {
	await loadBoltModules(loadPath, boltImportOptions, allowedZones);
	boltLoaded = true;
	bolt.emit('ready');
}

/**
 * Direct app launcher (not using pm2).  Will basically launch the app detailed in the supplied config.
 *
 * @public
 * @param {Object} config   All the config information for the app to launch.
 * @returns {Promise}       Promise resolving when app launched.
 */
async function appLauncher(config) {
	if (!!configDone) return Promise.resolve();
	configDone = true;
	bolt.require.set('roots', config.root);
	if (!boltLoaded) await _loadBoltModules('./bolt/', {basedir: __dirname, parent: __filename}, ['server']);
	return _startApp(config);
}

/**
 * PM2 app launcher.  Will launch given app using pm2.  The app launching actually, happens when config is sent via a
 * process message and then passed to appLauncher().
 *
 * @public
 * @returns {Promise}   Promise resolving when app launched.
 */
async function pm2Controller() {
	const zones = [((process.getuid && process.getuid() === 0) ? 'manager' : 'server')];
	await _loadBoltModules('./bolt/', {basedir: __dirname, parent: __filename}, zones);

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


if (!module.parent && !process.env.pm_uptime) pm2Controller();
module.exports = appLauncher;
