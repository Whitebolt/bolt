'use strict';

const launcher = require(boltRootDir + '/server');

/**
 * Launch a bolt application.
 *
 * @param {Object} siteConfig     The application config to use to fire it up.
 */
function launchApp(siteConfig) {
  const boltConfigProperties = (bolt.mergePackageConfigs(siteConfig.root) || {}).boltConfigProperties;
  let boltConfig = bolt.pick(siteConfig, boltConfigProperties);
  launcher(boltConfig);
}

/**
 * Start an bolt application.
 *
 * @param {Object} args     Arguments parsed from the commandline.
 * @returns {Promise}       Promise resolving when app has launched.
 */
async function start(args) {
  if (args.hasOwnProperty('name')) {
    const siteConfig = await bolt.loadConfig(args.name, args.profile);
    siteConfig.development = ((process.getuid && process.getuid() !== 0)?true:args.development) || siteConfig.development;
    if (!siteConfig.development) {
      await bolt.addUser(siteConfig);
      await bolt.launchNginx(siteConfig);
      const app = await bolt.pm2LaunchApp(siteConfig);
      console.log(app.pm2_env.name, 'launched with id:', app.pm2_env.pm_id);
      process.exit();
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
