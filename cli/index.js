'use strict';

const argv = require('yargs')
  .command('start <name>', 'Start the server process.')
  .argv;

if (!argv.development && argv.d) argv.development = argv.d;
if (!argv.development && !argv.d) argv.development = false;

module.exports = argv;