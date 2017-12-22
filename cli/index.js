'use strict';

/**
 * @todo Add automatic assignment of command when done via npm. eg. npm start "websitename".
 * @todo Add automatic assignment when command is in gulp.
 */

const argv = require('yargs')
	.command('start [<name>] [<profile>]', 'Start a new bolt server.', yargs=>{
		yargs.positional('name', {
			describe: 'The app to run.'
		}).positional('profile', {
			describe: 'The profile to apply to the server.'
		});
	})
	.command('list', 'List all running servers, local and remote.')
	.command('restart', 'Restart a given bolt server.')
	.command('kill', 'Kill a given bolt server.')
	.command('status', 'Show the status of a given bolt server.')
	.command('init [<project>]', 'Create a project stub for a bolt module.', yargs=>{
		yargs.positional('project', {
			describe: 'The project name.'
		})
	})
	.argv;

if (!argv.development && argv.d) argv.development = argv.d;
if (!argv.development && !argv.d) argv.development = false;

argv.cmd = {};

module.exports = require.import('./cmd/', {
	merge:true,
	imports:argv.cmd,
	basedir: __dirname,
	parent: __filename
}).then(()=>argv);
