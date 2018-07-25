'use strict';
// @annotation zone server

const util = require('util');
const path = require('path');
const exec = util.promisify(require('child_process').exec);


process.on('warning', warning=> console.warn(warning.stack));
process.on('uncaughtException', err=>console.error('uncaughtException', err));

function exitHandler(controller) {
	process.on('exit', controller.remove.bind(controller, true));
	process.on('SIGINT', controller.remove.bind(controller, true));
	process.on('SIGUSR1', controller.remove.bind(controller, true));
	process.on('SIGUSR2', controller.remove.bind(controller, true));
}

class Pid_Controller {
	constructor(path, name, user={}) {
		this.id = process.pid;
		this.name = `${this.id}-${name}`;
		this.pidFile = `${path}/${this.name}.pid`;
		this.uid = user.uid;
		this.gid = user.gid;
	}

	async create() {
		try {
			await bolt.fs.writeFile(this.pidFile, new Buffer(`${this.id}\n`), {flag: 'wx', createDirectories:true});
			bolt.emit('createdPidFile', this.pidFile);
		} catch(error) {
			console.log(`Failed to create pid file ${this.pidFile}.`);
			console.error(error);
		}
		exitHandler(this);
	}

	async remove(exit=false) {
		try {
			await bolt.fs.unlink(this.pidFile);
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