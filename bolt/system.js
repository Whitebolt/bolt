'use strict';

/**
 * @module bolt/bolt
 */

const linuxUserAwait = require.try(true, '@simpo/linux-user');
const util = require('util');
const chown = util.promisify(require('chownr'));
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
const stat = util.promisify(fs.stat);

/**
 * Create a given user.
 *
 * @private
 * @param {boltConfig} config   The bolt config object.
 * @returns {Promise.<Object>}
 */
async function _createUser(config) {
	const linuxUser = await linuxUserAwait;
	var options = {username: config.userName};
	if (config.homeDir) options.d = config.homeDir;
	await  linuxUser.addUser(options)
	return linuxUser.getUserInfo(config.userName);
}

/**
 * Add user and group specified in supplied config if not already present.
 * Endure all the application directories are appropriately accessible for
 * the given user.
 *
 * @param {boltConfig} config       The bolt config objecct.
 * @returns {Promise.<boltConfig>}  Promise resolving to the bolt config object.
 */
async function addUser(config) {
	if (!config.userName) return config;
	const linuxUser = await linuxUserAwait;
	if (!(await linuxUser.isUser(config.userName))) await _createUser(config);
	const user = await linuxUser.getUserInfo(config.userName);
	await chown(user.homedir, user.uid, user.gid);

	await Promise.all(bolt.makeArray(config.root).map(async (root)=>{
		let publicDir = root + 'public';
		try {
			await stat(publicDir);
			await exec('setfacl -RLm "u:'+user.uid+':rwx,d:'+user.uid+':rwx,g:'+user.gid+':rwx" '+publicDir);
		} catch (err) {}
	}));

	config.uid = user.uid;
	config.gid = user.gid;
}

module.exports = {
	addUser
};
