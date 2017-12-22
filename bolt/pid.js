'use strict';

const fs = require('fs');
const util = require('util');
const path = require('path');
const write = util.promisify(fs.writeFile);
const remove = util.promisify(fs.unlink);

function exitHandler(controller) {
	process.on('exit', controller.remove.bind(controller, true));
	process.on('SIGINT', controller.remove.bind(controller, true));
	process.on('SIGUSR1', controller.remove.bind(controller, true));
	process.on('SIGUSR2', controller.remove.bind(controller, true));
	process.on('uncaughtException', controller.remove.bind(controller, true));
}

class Pid_Controller {
	constructor(path, name) {
		this.id = process.pid;
		this.name = `${this.id}-${name}`;
		this.pidFile = `${path}/${this.name}.pid`;
	}

	async create() {
		try {
			await bolt.makeDirectory(path.dirname(this.pidFile));
			await write(this.pidFile, new Buffer(`${this.id}\n`), {flag: 'wx'});
			bolt.emit('createdPidFile', this.pidFile);
		} catch(error) {
			console.log(`Failed to create pid file ${this.pidFile}.`);
			console.error(error);
		}
		exitHandler(this);
	}

	async remove(exit=false) {
		try {
			await remove(this.pidFile);
		} catch(error) {
			console.warn(`Failed to remove pidfile: ${this.pidFile}.`);
		}
		bolt.emit('removedPidFile', this.pidFile);
		if (exit) process.exit();
	}
}

module.exports = {
	Pid_Controller
};