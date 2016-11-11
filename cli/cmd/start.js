'use strict';

const launcher = require(boltRootDir + '/server');

function launchApp(siteConfig) {
  const boltConfigProperties = require(boltRootDir + '/package.json').config.boltConfigProperties;
  let boltConfig = bolt.pick(siteConfig, boltConfigProperties);
  launcher(boltConfig);
}

function start(args) {
  if (args.hasOwnProperty('name')) {
    let development = (!process.env.SUDO_UID || args.development);

    return bolt.loadConfig(args.name, args.profile).then(siteConfig=>{
      if (development) siteConfig.development = development;
      return siteConfig;
    }).then(siteConfig=>{
      if (!siteConfig.development) return bolt.addUser(siteConfig).then(()=>siteConfig);
      return siteConfig;
    }).then(siteConfig=>
      (!siteConfig.development ? bolt.launchNginx(siteConfig) : siteConfig)
    ).then(
      siteConfig=>{
        if (siteConfig.development) return launchApp(siteConfig);
        console.log('Assigned app to TCP port no.', siteConfig.port);
        return bolt.pm2LaunchApp(siteConfig);
      },
      err=>console.log(err)
    ).then(app=>{
      if (app && app.pm2_env) {
        console.log(app.pm2_env.name, 'launched with id:', app.pm2_env.pm_id);
        process.exit();
      }
    });
  } else {
    throw new Error("No app specified");
  }
}

module.exports = {
  start
};
