'use strict';
// @annotation zone server

const nodeCron = require('node-cron');

class CronTab {
	constructor() {
		this.tasks = Object.create(null);
	}

	create({when, fn, immediateStart=false, runNow=false, name}) {
		const _fn = (...params)=>{
			bolt.emit('runningCronTask', name || 'anonymous');
			return fn(...params);
		};
		if (runNow) setImmediate(()=>_fn());
		const task = nodeCron.schedule(when, _fn);
		if (immediateStart) task.start();
		if (!!name) {
			if (name in this.tasks) throw new RangeError(`Cannot add task: ${name}, as a task of that name already exists.`);
			this.tasks[name] = task;
		}
		return task;
	}

	start(name) {
		if (!(name in this.tasks)) throw new RangeError(`Cannot start task: ${name}, as it does not exist in this crontab.`);
		this.tasks[name].start();
	}

	stop(name) {
		if (!(name in this.tasks)) throw new RangeError(`Cannot stop task: ${name}, as it does not exist in this crontab.`);
		this.tasks[name].stop();
	}

	delete(name) {
		if (!(name in this.tasks)) throw new RangeError(`Cannot delete task: ${name}, as it does not exist in this crontab.`);
		this.tasks[name].destroy();
	}
}

const crontab = new CronTab();

function cron(...params) {
	return crontab.create(...params);
}

cron.delete = crontab.delete.bind(crontab);
cron.stop = crontab.delete.bind(crontab);
cron.start = crontab.delete.bind(crontab);


module.exports = {
	cron
};