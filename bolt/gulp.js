'use strict';
// @annotation zone server gulp

const child = require('child_process');
const write = require('util').promisify(require('fs').writeFile);
const path = require('path');

const {
	xParseGulpLog,
	xAnsi,
	xGulpUsing,
	xGetGulpTaskNamePath,
	xGulpFinishedAfter,
	xGetGulpTaskName,
	xNewLine
} = bolt.consts;

function runGulp(taskName, {config}, args=[]) {
	const startTime = process.hrtime();
	config.boltGulpModules = [...bolt.__modules]
		.filter(target=>(bolt.annotation.get(require(target), 'zone') || new Set()).has('gulp'));
	const boltConfigPropsDeleteWhenLive = new Set(bolt.makeArray(config.boltConfigPropsDeleteWhenLive));
	const gulpConfig = Object.assign(...bolt.chain(config)
		.keys()
		.filter(key=>!boltConfigPropsDeleteWhenLive.has(key))
		.map(key=>{
			return {[key]:config[key]};
		})
		.value()
	);

	const gulp = child.spawn(
		'gulp',
		[
			taskName,
			...args,
			...bolt.objectToArgsArray(gulpConfig, 'settings')
		],
		{cmd: boltRootDir}
	);

	let gulpTaskName = 'Unknown';
	let gulpTaskPath = '';

	let current = '';
	gulp.stdout.on('data',data=>{
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

	gulp.stderr.on('data', data=>console.error('Gulp Error: ', data.toString()));

	gulp.on('close', code=>{
		const timeTaken = process.hrtime(startTime);
		let message = `Done in ${timeTaken[0]}.${timeTaken[1].toString().substr(0,3)}s`;
		if (code > 0) message += ` Exited with code ${code}`;
		bolt.emit('gulpLog', gulpTaskName, message)
	});
}

function getRollupBundleCache({cacheDir, id}) {
	try {
		return require(path.join(cacheDir, `${id}.json`));
	} catch(err) {
	}
}

async function saveRollupBundleCache({bundle, cacheDir, id, waiting, done}) {
	try {
		await bolt.makeDirectory(cacheDir);
		await write(
			path.join(cacheDir, `${id}.json`),
			JSON.stringify(bundle)
		);
	} catch(err) {
		console.error(err);
	}
	waiting.current--;
	if (waiting.current <= 0) done();
}

function waitCurrentEnd({done, waiting}) {
	waiting.current--;
	if (waiting.current <= 0) done();
}

module.exports = {
	runGulp, getRollupBundleCache, saveRollupBundleCache, waitCurrentEnd
};