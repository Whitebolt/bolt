'use strict';

/**
 * @module bolt/bolt
 */

const util = require('util');
const chalk = require('chalk');
const figlet =  util.promisify(require('figlet'));
const {upgrade} = require('@simpo/websocket-express');
const exec = util.promisify(require('child_process').exec);

async function _getHttpsOptions(app) {
	return {
		key: bolt.fs.readFile(app.config.sslServerKey),
		cert: bolt.fs.readFile(app.config.sslServerCrt),
		requestCert: false,
		rejectUnauthorized: false
	};
}

async function _createServer(app, config=app.config) {
	let server;

	if (config.development && !config.production && config.sslServerCrt && config.sslServerKey) {
		try {
			return require('https').createServer(await _getHttpsOptions(app), app);
		} catch(err) {}
	}
	return require('http').createServer(app);
}

async function _doRootTasksAndDowngrade(config) {
	await bolt.makeDirectory(config.runDirectory);
	const pidController = new bolt.Pid_Controller(config.runDirectory, config.name, config);
	await pidController.create();
	await exec(`chown -R ${config.nginx.user}:${config.nginx.group} ${config.runDirectory}`);
	process.setgid(config.gid);
	process.setuid(config.uid);
}

function _deleteSecretConfigProps(app) {
	bolt.makeArray(app.config.boltConfigPropsDeleteWhenLive).forEach(prop=>{
		if (app.config[prop]) delete app.config[prop];
	});
	bolt.deepFreeze(app.config);
}

async function _createWelcome(app) {
	let serverName = bolt.upperFirst(bolt.camelCase(app.config.serverName.split('/').pop())).match(/[A-Z][a-z]+/g).join(' ');
	let welcome = await figlet(`${serverName} `);
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

	return welcomeMessage;
}

/**
 * Run the given express app, binding to correct port.
 *
 * @private
 * @param {Object} app      Express application object.
 * @returns {Promise}       Promise resolved when app has launched fully.
 */
function _runApp(app) {
	return new Promise(async (resolve)=>{
		const server = await _createServer(app);

		server.listen(app.config.sock || app.config.port, async ()=>{
			if (app.config.uid && app.config.gid && !app.config.development) {
				await _doRootTasksAndDowngrade(app.config);
			}

			_deleteSecretConfigProps(app);
			bolt.emit('appListening', app.config.port);
			console.log(await _createWelcome(app));
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
