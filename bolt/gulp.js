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


function getZones(target) {
	return bolt.annotation.get(require(target), 'zone') || new Set();
}

function getBoltModules() {
	return [...bolt.__modules].filter(target=>getZones(target).has('gulp'));
}

function getGulpConfig(locals) {
	const boltConfigPropsDeleteWhenLive = new Set(bolt.makeArray(locals.boltConfigPropsDeleteWhenLive));
	const config = Object.assign(...bolt.chain(locals)
		.keys()
		.filter(key=>!boltConfigPropsDeleteWhenLive.has(key))
		.map(key=>{
			return {[key]:locals[key]};
		})
		.value()
	);

	return Buffer.from(JSON.stringify(config), 'utf-8').toString('base64');
}

function getGulpSpawnFlags(locals, args, taskName) {
	const gulpConfig = getGulpConfig({...locals, boltGulpModules:getBoltModules()});
	const verbose = ((bolt.get(locals, 'logLevel', 3) < 3) ? '--verbose' : '');
	const flags = [taskName, ...args, `--boltRootDir=${boltRootDir}`, `--settingsBase64=${gulpConfig}`, '--no-color'];
	if (bolt.get(locals, 'logLevel', 3) < 3) flags.push('--verbose');
	return flags;
}

const parseLogLine = bolt.memoize(function parseLogLine(data) {
	const [full, date, info] = data.match(xParseGulpLog) || [];
	return [date, info];
});

function parseLogInfo(info, rx) {
	const [fullMatch, taskId, taskPath] = info.toString().match(rx) || [];
	return [taskId, taskPath];
}

function handleLogLine(data, task, last) {
	const [date, info] = parseLogLine(data);
	if (last && !date && !info) { // Sometimes you have just the date with info to follow.
		task.currentLine = data.trim() + ' ';
		return;
	}
	if (xGulpFinishedAfter.test(info)) return;
	if (!date || !info) return console.error(data);

	if (xGulpUsing.test(info)) return bolt.emit('gulpLogGulpfileInfo', 'load', info);

	let [taskId, taskPath] = parseLogInfo(info, xGetGulpTaskNamePath);
	if (!!taskId || !!taskPath) {
		if (!!taskId) task.name = taskId;
		if (!!taskPath) task.path = taskPath;
		return bolt.emit('gulpLog', task.name, `Starting task: ${task.path}`);
	}

	[taskId] = parseLogInfo(info, xGetGulpTaskName);
	if (!taskId) return bolt.emit('gulpLog', task.name, info);
	task.name = taskId;
}

function onData(task) {
	return data=>{
		task.currentLine += data.toString();
		const [date, info] = parseLogLine(task.currentLine);
		if (!xNewLine.test(task.currentLine)) return;
		if (!!date && (!!info && (info.trim() === ''))) { // Sometimes you have just the date with info to follow.
			task.currentLine = task.currentLine.trim() + ' ';
			return;
		}

		data = task.currentLine;
		task.currentLine = '';

		bolt.chain(data.toString().split('\n'))
			.map(data=>data.replace(xAnsi, '').trim())
			.filter(data=>(data !== ''))
			.forEach((data, n, ary)=>handleLogLine(data, task, (n===(ary.length-1))))
			.value();
	};
}

function onError() {
	return err=>{
		console.error('Gulp Error: ', err.toString());
	};
}

function onClose(task, resolve, reject) {
	return code=>{
		const timeTaken = process.hrtime(task.startTime);
		parseLogLine.cache.clear();
		let message = `Done in ${timeTaken[0]}.${timeTaken[1].toString().substr(0,3)}s`;
		if (code > 0) message += ` Exited with code ${code}`;
		bolt.emit('gulpLog', task.name, message);
		return (code>0)?reject(code):resolve(code);
	}
}

function runGulp(taskName, {locals}, args=[]) {
	const task = {
		name: 'unknown',
		path: '',
		currentLine: '',
		startTime: process.hrtime()
	};

	const gulp = child.spawn('gulp', getGulpSpawnFlags(locals, args, taskName), {cmd: boltRootDir});
	gulp.stdout.on('data', onData(task));
	gulp.stderr.on('data', onError(task));
	return new Promise((resolve, reject)=>gulp.on('close', onClose(task, resolve, reject)));
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