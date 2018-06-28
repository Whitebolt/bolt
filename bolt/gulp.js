'use strict';

const child = require('child_process');

const xParseGulpLog = /^\[(\d\d\:\d\d\:\d\d)\]\s+(.*)/;
const xAnsi = /\x1b\[[0-9;]*[a-zA-Z]/g;
const xGulpUsing = /^Using gulpfile /;
const xGetGulpTaskNamePath = /^Found task \'(.*?)\' in (.*)/;
const xGulpFinishedAfter = /^Finished \'.*?\' after .*$/;
const xGetGulpTaskName = /^Starting \'(.*?)\'/;
const xNewLine = /\n/;

function runGulp(taskName, {config}, args=[]) {
	const startTime = process.hrtime();
	const ls = child.spawn(
		'gulp',
		[
			taskName,
			...args,
			...bolt.objectToArgsArray(config, 'settings')
		],
		{cmd: boltRootDir}
	);

	let gulpTaskName = 'Unknown';
	let gulpTaskPath = '';

	let current = '';
	ls.stdout.on('data',data=>{
		current += data.toString();
		if (xNewLine.test(current)) {
			data = current;
			current = '';
			bolt.chain(data.toString().split('\n'))
				.map(data=>data.replace(xAnsi, '').trim())
				.filter(data=>(data !== ''))
				.forEach(data=>{
					const [full, date, info] = data.match(xParseGulpLog) || [];
					if (xGulpFinishedAfter.test(info)) return;
					if (!!date && !!info) {
						if (xGulpUsing.test(info))  return bolt.emit('gulpLogGulpfileInfo', 'load', info);
						const [fullMatch, taskId, taskPath] = info.toString().match(xGetGulpTaskNamePath) || [];
						if (!!taskId || !!taskPath) {
							if (!!taskId) gulpTaskName = taskId;
							if (!!taskPath) gulpTaskPath = taskPath;
							return bolt.emit('gulpLog', gulpTaskName, `Starting task: ${gulpTaskPath}`);
						} else {
							const [fullMatch, taskId] = info.toString().match(xGetGulpTaskName) || [];
							if (!!taskId) {
								gulpTaskName = taskId;
								return;
							} else {
								return bolt.emit('gulpLog', gulpTaskName, info);
							}
						}
					}
					console.error(data);
				})
				.value();

		}
	});

	ls.stderr.on('data', data=>console.error('Gulp Error: ', data.toString()));

	ls.on('close', code=>{
		const timeTaken = process.hrtime(startTime);
		let message = `Done in ${timeTaken[0]}.${timeTaken[1].toString().substr(0,3)}s`;
		if (code > 0) message += ` Exited with code ${code}`;
		bolt.emit('gulpLog', gulpTaskName, message)
	});
}

module.exports = {
	runGulp
};