'use strict';
// @annotation zone server gulp

const child = require('child_process');
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

//const cache = bolt.getStore('gulp.runCache');

function runGulp(taskName, {locals}, args=[]) {
	const startTime = process.hrtime();
	locals.boltGulpModules = [...bolt.__modules]
		.filter(target=>(bolt.annotation.get(require(target), 'zone') || new Set()).has('gulp'));
	const boltConfigPropsDeleteWhenLive = new Set(bolt.makeArray(locals.boltConfigPropsDeleteWhenLive));
	const gulpConfig = Buffer.from(JSON.stringify(Object.assign(...bolt.chain(locals)
		.keys()
		.filter(key=>!boltConfigPropsDeleteWhenLive.has(key))
		.map(key=>{
			return {[key]:locals[key]};
		})
		.value()
	))).toString('base64');



	const flags = [taskName, ...args, `--settingsBase64=${gulpConfig}`];
	const gulp = child.spawn('gulp', flags, {cmd: boltRootDir});
	//cache.set(taskName, {flags, cmd:boltRootDir});

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

	return new Promise((resolve, reject)=>gulp.on('close', code=>{
		const timeTaken = process.hrtime(startTime);
		let message = `Done in ${timeTaken[0]}.${timeTaken[1].toString().substr(0,3)}s`;
		if (code > 0) message += ` Exited with code ${code}`;
		bolt.emit('gulpLog', gulpTaskName, message);
		return (code>0)?reject(code):resolve(code);
	}));
}

function getRollupBundleCache({cacheDir, id}) {
	try {
		return require(path.join(cacheDir, `${id}.json`));
	} catch(err) {}

	return {};
}

async function saveRollupBundleCache({bundle, cacheDir, id, waiting, done}) {
	try {
		await bolt.writeFile(path.join(cacheDir, `${id}.json`), bundle, {createDirectories:true, json:true})
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