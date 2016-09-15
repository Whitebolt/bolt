#!/usr/bin/env node
'use strict';

global.boltRootDir = __dirname;
global.bolt = require('lodash');

const launcher = require('./server');
const args = require('./cli');


function launchApp(siteConfig) {
  const boltConfigProperties = require(boltRootDir + '/package.json').config.boltConfigProperties;
  let boltConfig = bolt.pick(siteConfig, boltConfigProperties);
  launcher(boltConfig);
}

/**
 * @todo Add a filter here do not need entire object.
 */
return require('require-extra').importDirectory('./bolt/', {
  merge: true,
  imports: bolt
}).then(()=>{
  if (bolt.indexOf(args._, 'start') !== -1) {
    if (args.hasOwnProperty('name')) {
      bolt.loadConfig(args.name).then(siteConfig=>{
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
    }
  }
});
