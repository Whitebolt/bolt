'use strict';

/**
 * @module bolt/bolt
 */

const globalModules = require('global-modules');
const pm2 = require('bluebird').promisifyAll(require(`${globalModules}/pm2`));
const processFileProperties = Object.keys(require(`${globalModules}/pm2/lib/API/schema.json`));


/**
 * Remove current named instance that matches app named in supplied config (if it exists).
 *
 * @private
 * @param {Object} pm2Config    The pm2 application object.
 * @returns {Promise.<Object|boolean>}
 */
function _removeOldInstances(pm2Config) {
	return _getPm2Instances(pm2Config.name).then(apps=>(
		apps.length ?
			Promise.all(apps.map(app=>pm2.deleteAsync(app.pm2_env.pm_id))) :
			true
	));
}

/**
 * Get a specific pm2 instance object.
 *
 * @private
 * @param {string} name           The instance name to get.
 * @returns {Promise.<Object>}    Promise resolving to instance object.
 */
function _getPm2Instances(name) {
	return pm2.listAsync()
		.filter(apps=>(apps.name === name));
}

/**
 * Start bolt server in pm2,passing the boltConfig through.
 *
 * @private
 * @param {Object} pm2Config      The pm2 app config.
 * @param {Object} boltConfig     The bolt config object.
 * @returns {Promise.<Object>}
 */
function _startInstance(pm2Config, boltConfig) {
	return pm2.startAsync(pm2Config).then(app=>{
		const id = app[0].pm2_env.pm_id;
		if (boltConfig.debug) process.kill(app[0].pid, 'SIGUSR1');
		pm2.sendDataToProcessId(id, {type:'config', data:boltConfig, id, topic:'config'});
		return pm2.disconnectAsync().then(()=>app[0]);
	});
}

/**
 * Luanch bolt app via pm2.
 *
 * @static
 * @public
 * @param {boltConfig} siteConfig   The bolt configuration options.
 * @returns {Promise.<Object>}      Promise resolving to pm2 application object.
 */
function pm2LaunchApp(siteConfig) {
	const boltConfigProperties = (bolt.mergePackageConfigs(siteConfig.root || []) || {}).boltConfigProperties;
	let pm2Config = bolt.pick(siteConfig, processFileProperties);
	if (pm2Config.uid) delete pm2Config.uid;
	if (pm2Config.gid) delete pm2Config.gid;
	let boltConfig = bolt.pick(siteConfig, boltConfigProperties);

	return pm2.connectAsync()
		.then(()=>_removeOldInstances(pm2Config))
		.then(()=>_startInstance(pm2Config, boltConfig));
}

module.exports = {
	pm2LaunchApp
};