'use strict';

/**
 * @module bolt/bolt
 */

const util = require('util');
const chalk = require('chalk');
const figlet =  util.promisify(require('figlet'));
const {upgrade} = require('websocket-express');


/**
 * Run the given express app, binding to correct port.
 *
 * @private
 * @param {Object} app      Express application object.
 * @returns {Promise}       Promise resolved when app has launched fully.
 */
function _runApp(app) {
	if (app.config.uid && app.config.gid && !app.config.development) { // downgrade from route just before going live.
		process.setgid(app.config.gid);
		process.setuid(app.config.uid);
	}

	return new Promise(async (resolve)=>{
		let server;

		if (app.config.development) {
			try {
				const fs = require('fs');
				let options = {
					key: fs.readFileSync(boltRootDir + '/server.key'),
					cert: fs.readFileSync(boltRootDir + '/server.crt'),
					requestCert: false,
					rejectUnauthorized: false
				};
				server = require('https').createServer(options, app);
			} catch(err) {}
		}
		if (!server) server = require('http').createServer(app);

		const pidController = new bolt.Pid_Controller('/tmp/run/bolt/pids', app.config.name);
		await pidController.create();

		server.listen(app.config.port, async ()=>{
			bolt.emit('appListening', app.config.port);
			let serverName = bolt.upperFirst(bolt.camelCase(app.config.serverName)).match(/[A-Z][a-z]+/g).join(' ');
			let welcome = await figlet(`${serverName.split('/').pop()} `);
			let version = await figlet(`v${app.config.version}`);
			let wLineLength = 0;
			let vLineLength = 0;

			welcome = welcome.toString().split('\n').map(line=>{
				if (wLineLength < line.length) wLineLength = line.length;
				return chalk.blue.bold(line);
			});
			version = version.toString().split('\n').map(line=>{
				if (vLineLength < line.length) vLineLength = line.length;
				return chalk.green.bold(line);
			});

			let welcomeMessage = '';
			for(let n=0; ((n<welcome.length) || (n<version.length)); n++) {
				welcomeMessage += ((n < welcome.length) ? welcome[n] : ''.padStart(wLineLength)) +
					((n < version.length) ? version[n] : ''.padStart(vLineLength)) +
					'\n';
			}

			console.log(welcomeMessage);
			bolt.emit('appRunning', app.config.name, process.hrtime(global.startTime));
			resolve(app);
		});

		upgrade(server, app);


	});
}

/**
 * Run the given express app, binding to correct port.
 *
 * @public
 * @param {Object} app      Express application object.
 * @returns {Promise}       Promise resolved when app has launched fully.
 */
async function runApp(app) {
	await bolt.emitThrough(()=>_runApp(app), 'runApp', app);
	return app;
}

module.exports = {
	runApp
};
