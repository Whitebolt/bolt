'use strict';

/**
 * @module bolt/bolt
 */

const util = require('util');
const chalk = require('chalk');
const figlet =  util.promisify(require('figlet'));
const {upgrade} = require('@simpo/websocket-express');
const exec = util.promisify(require('child_process').exec);

/**
 * Create the options needed for https.
 *
 * @private
 * @async
 * @param {Object} config		The bolt config.
 * @returns {Object}			Node server instance options.
 */
async function _getHttpsOptions(config) {
	return {
		key: await bolt.fs.readFile(config.sslServerKey),
		cert: await bolt.fs.readFile(config.sslServerCrt),
		requestCert: false,
		rejectUnauthorized: false
	};
}

/**
 * Create a new server instance
 *
 * @private
 * @param {BoltApplication} app		The bolt application to create server for.
 * @param {Object} config			The bolt config.
 * @returns {Object}				The new server instance.
 */
async function _createServer(app, config=app.config) {
	if (config.development && !config.production && config.sslServerCrt && config.sslServerKey) {
		try {
			return require('https').createServer(await _getHttpsOptions(app.config), app);
		} catch(error) {}
	}
	return require('http').createServer(app);
}

/**
 * Do various root tasks (when initially ran as root). Tasks include, pid creastion, giving nginx access to sock files
 * and downgrading the user to the site user.
 *
 * @note This could have been a hook but this seems more secure.
 * @todo Pids and Socks not deleted on close as no-longer have access.  A fixd is needed.
 *
 * @private
 * @async
 * @param {Object} config		The application config.
 */
async function _doRootTasks1(config) {
	await bolt.makeDirectory(config.runDirectory);
	const pidController = new bolt.Pid_Controller(config.runDirectory, config.name, config);
	await pidController.create();
}

async function _doRootTasks2(config) {
	await exec(`chown -R ${config.nginx.user}:${config.nginx.group} ${config.runDirectory}`);
	await exec(`setfacl -RLm "u:${config.uid}:rw" ${pidController.pidFile}`);
	await exec(`setfacl -RLm "u:${config.uid}:rw" ${config.sock}`);
	process.setgid(config.gid);
	process.setuid(config.uid);
}

/**
 * Delete properties we do not want to be available to hackers.  Deep freeze the config to stop people changing it.
 *
 * @todo These need a rethink, perhaps config is only needed on load but not after?
 *
 * @private
 * @param {BoltApplication} app		The bolt application to delete config properties on.
 */
function _deleteSecretConfigProps(app) {
	bolt.makeArray(app.config.boltConfigPropsDeleteWhenLive).forEach(prop=>{
		if (app.config[prop]) delete app.config[prop];
	});
	bolt.deepFreeze(app.config);
}

/**
 * Create the welcome banner displayed in the console.
 *
 * @private
 * @async
 * @param {Object} config	The application configuration.
 * @returns {string}		The welcome message to display.
 */
async function _createWelcome(config) {
	let serverName = bolt.upperFirst(bolt.camelCase(config.serverName.split('/').pop())).match(/[A-Z][a-z]+/g).join(' ');
	let welcome = await figlet(`${serverName} `);
	let version = await figlet(`v${config.version}`);
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
 * @param {Object} app						Express application object.
 * @returns {Promise.<BoltApplication>}		Promise resolved when app has launched fully.
 */
function _runApp(app) {
	const config = app.config;
	const root = (config.uid && config.gid && !config.development);

	return new Promise(async (resolve)=>{
		const server = await _createServer(app);
		if (root) await _doRootTasks1(config);

		server.listen(config.sock || config.port, async ()=>{
			if (root) await _doRootTasks2(config);
			_deleteSecretConfigProps(app);
			bolt.emit('appListening', config.sock || config.port);
			console.log(await _createWelcome(config));
			bolt.emit('appRunning', config.name, process.hrtime(global.startTime));
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
