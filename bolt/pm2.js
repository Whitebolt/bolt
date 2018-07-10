'use strict';
// @annotation zone manager

/**
 * @module bolt/bolt
 */

const path = require('path');
const globalModules = require('global-modules');
const processFileProperties = Object.keys(require(path.join(globalModules, 'pm2', 'lib', 'API', 'schema.json')));
const pm2 = require(path.join(globalModules, 'pm2'));
const {
	delete:deleteApp,
	list:listApps,
	start:startApp,
	disconnect:disconnectApp,
	connect:connectApp
	} = promisifyMethods(pm2, ['delete','list','start','disconnect','connect']);


function promisifyMethods(instance, methods, append='') {
	const promiseMethods = {};
	bolt.makeArray(methods).forEach(method=>{
		promiseMethods[method] = (...params)=>new Promise((resolve, reject)=>{
			return instance[method](...params, (rejected, resolved)=>{
				if (!rejected) return resolve(resolved);
				return reject(rejected);
			});
		});
	});
	return promiseMethods;
}

/**
 * Remove current named instance that matches app named in supplied config (if it exists).
 *
 * @private
 * @param {Object} pm2Config    The pm2 application object.
 * @returns {Promise.<Object|boolean>}
 */
async function _removeOldInstances(pm2Config) {
	const apps = await _getPm2Instances(pm2Config.name);
	return Promise.all(apps.length ? apps.map(app=>deleteApp(app.pm2_env.pm_id)) : [Promise.resolve(true)]);
}

/**
 * Get a specific pm2 instance object.
 *
 * @private
 * @param {string} name           The instance name to get.
 * @returns {Promise.<Object>}    Promise resolving to instance object.
 */
async function _getPm2Instances(name) {
	const apps = await listApps();
	return apps.filter(apps=>(apps.name === name));
}

/**
 * Start bolt server in pm2,passing the boltConfig through.
 *
 * @private
 * @param {Object} pm2Config      The pm2 app config.
 * @param {Object} boltConfig     The bolt config object.
 * @returns {Promise.<Object>}
 */
async function _startInstance(pm2Config, boltConfig) {
	const [app] = await startApp(pm2Config);
	const id = app.pm2_env.pm_id;
	if (boltConfig.debug) process.kill(app.pid, 'SIGUSR1');
	pm2.sendDataToProcessId(id, {type:'config', data:boltConfig, id, topic:'config'});
	await disconnectApp();
	return app;
}

/**
 * Luanch bolt app via pm2.
 *
 * @static
 * @public
 * @param {boltConfig} siteConfig   The bolt configuration options.
 * @returns {Promise.<Object>}      Promise resolving to pm2 application object.
 */
async function pm2LaunchApp(siteConfig) {
	let pm2Config = bolt.pick(siteConfig, processFileProperties);
	if (pm2Config.uid) delete pm2Config.uid;
	if (pm2Config.gid) delete pm2Config.gid;

	await connectApp();
	await _removeOldInstances(pm2Config);
	return _startInstance(pm2Config, siteConfig);
}

module.exports = {
	pm2LaunchApp
};