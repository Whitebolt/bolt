'use strict';

const launcher = require(boltRootDir + '/server');

function launchApp(siteConfig) {
  const boltConfigProperties = require(boltRootDir + '/package.json').config.boltConfigProperties;
  let boltConfig = bolt.pick(siteConfig, boltConfigProperties);
  launcher(boltConfig);
}

function start(args) {
  if (args.hasOwnProperty('name')) {
    return bolt.loadConfig(args.name).then(siteConfig=>{
      if (!process.env.SUDO_UID) siteConfig.development = true;
      if (args.development) siteConfig.development = true;
      return siteConfig;
    }).then(siteConfig=>{
      if (!siteConfig.development) return bolt.addUser(siteConfig).then(()=>siteConfig);
      return siteConfig;
    }).then(
      siteConfig=>((!siteConfig.development) ? bolt.pm2LaunchApp(siteConfig) : launchApp(siteConfig)),
      err=>console.log(err)
    ).then(app=>{
      if (app && app.pm2_env) {
        console.log(app.pm2_env.name, 'launched with id:', app.pm2_env.pm_id);
        process.exit();
      }
    });
  } else {
    throw "No profile specified";
  }
}

module.exports = {
  start
};
