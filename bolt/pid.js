'use strict';

const util = require('util');
const path = require('path');
const exec = util.promisify(require('child_process').exec);


process.on('warning', e => console.warn(e.stack));
process.on('uncaughtException', error=>{
	console.error('uncaughtException', error);
	//return controller.remove.bind(controller, true);
});

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
			await bolt.makeDirectory(path.dirname(this.pidFile));
			await bolt.fs.writeFile(this.pidFile, new Buffer(`${this.id}\n`), {flag: 'wx'});
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