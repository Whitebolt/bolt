'use strict';

const child = require('child_process');

const xParseGulpLog = /^\[(\d\d\:\d\d\:\d\d)\]\s+(.*)/;
const xAnsi = /\x1b\[[0-9;]*[a-zA-Z]/g;
const xGulpUsing = /^Using gulpfile /;
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
					if (!!date && !!info) {
						if (xGulpUsing.test(info))  return bolt.emit('gulpLogGulpfileInfo', 'load', info);
						const [fullMatch, task] = info.toString().match(xGetGulpTaskName) || [];
						if (!!task) {
							gulpTaskName = task;
							return bolt.emit('gulpLog', gulpTaskName, 'Starting task');
						} else {
							return bolt.emit('gulpLog', gulpTaskName, info);
						}
					}
					console.error('Gulp - Failed to parse message:', data);
				})
				.value();

		}
	});

	ls.stderr.on('data', data=>console.error('Gulp Error', data));

	ls.on('close', code=>{
		const timeTaken = process.hrtime(startTime);
		bolt.emit('gulpLog', gulpTaskName, `Done in ${timeTaken[0]}.${timeTaken[1].toString().substr(0,3)}s - Exited with code ${code}`)
	});
}

module.exports = {
	runGulp
};