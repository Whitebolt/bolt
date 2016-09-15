#!/usr/bin/env node
'use strict';

global.boltRootDir = __dirname;
global.bolt = require('lodash');

const launcher = require('./server');


const argv = require('yargs')
  .command('start <name>', 'Start the server process.')
  .argv;

if (!argv.development && argv.d) argv.development = argv.d;
if (!argv.development && !argv.d) argv.development = false;


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
  if (bolt.indexOf(argv._, 'start') !== -1) {
    if (argv.hasOwnProperty('name')) {
      bolt.loadConfig(argv.name).then(siteConfig=>{
        if (!process.env.SUDO_UID) siteConfig.development = true;
        if (argv.development) siteConfig.development = true;
        return siteConfig;
      }).then(
        siteConfig=>((!siteConfig.development) ? bolt.addUser(siteConfig) : siteConfig)
      ).then(
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
