#!/usr/bin/env node
'use strict';

let [configDone, boltLoaded] = [false, false];



const path = require('path');
const {loadBoltModule, loadLibModule, onBoltModuleReady, provideBolt} = require('./lib/loaders');
const bolt = init();



loadLibModule('platformScope')(bolt, __dirname, [loadBoltModule, loadLibModule]);
initEvents(bolt);
loadLibModule('requirex')(bolt, ()=>boltLoaded);
bolt.on('boltModuleReady', onBoltModuleReady);


const boltImportOptions = {
	merge: true,
	imports: bolt,
	retry: true,
	basedir: __dirname,
	parent: __filename,
	onerror: error=> {
		bolt.waitEmit('initialiseApp', 'boltModuleFail', error.source);
		console.error(error.error);
	}
};


function init() {
	const xSpaces = /\s+/;
	Error.stackTraceLimit = Infinity;
	Object.assign(global, {__originalCwd:process.cwd(), startTime:process.hrtime()});
	process.chdir(path.dirname(require('fs').realpathSync(__filename)));
	const requireX = require('require-extra').set('followHardLinks', true).set('useCache', true);
	const bolt = Object.assign(requireX.sync("lodash").runInContext(), {
		require:requireX,
		annotation:new (requireX.sync('@simpo/object-annotations'))(),
		__paths: new Set([__dirname])
	});
	bolt.annotation.addParser(value=>{
		// @annotation key zone
		return new Set([...value.split(xSpaces).map(zone=>zone.trim())]);
	});
	return provideBolt(bolt);
}

function initEvents(bolt) {
	Object.assign(bolt, loadBoltModule('event'));
	bolt.BoltModuleReadyEvent = class BoltModuleReadyEvent extends bolt.Event {};
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

		bolt.require.set('roots', config.root);

		if (!boltLoaded) {
			await bolt.require.import('./bolt/', {...boltImportOptions, onload: async(target, exports)=> {
				const event = new bolt.BoltModuleReadyEvent({
					type: 'boltModuleReady',
					sync: false,
					target,
					exports,
					allowedZones: ['server'],
					unload: false
				});
				await bolt.emit('boltModuleReady', event);
				return !event.unload;
			}});
			boltLoaded = true;
			bolt.emit('ready');
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
	const zones = [((process.getuid && process.getuid() === 0) ? 'manager' : 'server')];
	await bolt.require.import('./bolt/', {...boltImportOptions, onload: async (target, exports)=>{
		const event = new bolt.BoltModuleReadyEvent({
			type: 'boltModuleReady',
			sync: false,
			target,
			exports,
			allowedZones: zones,
			unload: false
		});
		await bolt.emit('boltModuleReady', event);
		return !event.unload;
	}});

	boltLoaded = true;
	bolt.emit('ready');
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
