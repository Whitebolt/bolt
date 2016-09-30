'use strict';

/**
 * @todo Add automatic assignment of command when done via npm. eg. npm start "websitename".
 * @todo Add automatic assignment when command is in gulp.
 */

const argv = require('yargs')
  .command('start <name>', 'Start the server process.')
  .argv;

if (!argv.development && argv.d) argv.development = argv.d;
if (!argv.development && !argv.d) argv.development = false;

argv.cmd = {};

module.exports = require('require-extra')
  .importDirectory('./cmd/', {merge:true, imports:argv.cmd, useSyncRequire:true})
  .then(()=>argv);
