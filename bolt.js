#!/usr/bin/env node
'use strict';

global.boltRootDir = __dirname;
global.bolt = require('lodash');


/**
 * @todo Add a filter here do not need entire object.
 */
return require('require-extra')
  .importDirectory('./bolt/', {merge: true, imports: bolt})
  .then(()=>require('./cli'))
  .then(args=>{
    return Promise.all(args._.map(cmd=>{
      if (args.cmd.hasOwnProperty(cmd)) {
        return args.cmd[cmd](args);
      }
    }));
  });
