'use strict';

const path = require('path');
const launcher = require(path.join(boltRootDir, 'server'));
const {showLoadMenus} = require('./lib/loadMenus');


/**
 * Launch a bolt application.
 *
 * @param {Object} siteConfig     The application config to use to fire it up.
 */
function launchApp(siteConfig) {
	launcher(siteConfig);
}

/**
 * Start an bolt application.
 *
 * @param {Object} args     Arguments parsed from the commandline.
 * @returns {Promise}       Promise resolving when app has launched.
 */
async function start(args) {
	const siteConfig = await showLoadMenus(args);

	if (args.hasOwnProperty('name') && args.hasOwnProperty('profile')) {
		if (!args.noclear) console.log('\x1bc'); // Clear the console

		if (!siteConfig.development && siteConfig.production) {
			siteConfig.sock = `${siteConfig.runDirectory}/${siteConfig.name}-${process.pid}.sock`;
			await bolt.addUser(siteConfig);
			await bolt.launchNginx(siteConfig);
			const app = await bolt.pm2LaunchApp(siteConfig);
			console.log(app.pm2_env.name, 'launched with id:', app.pm2_env.pm_id);
			process.exit(0);
		} else {
			await launchApp(siteConfig);
		}
	} else {
		throw new Error('No app specified');
	}
}

module.exports = {
	start
};
