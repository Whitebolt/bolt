#!/usr/bin/env node
'use strict';

global.bolt = Object.assign(
	require('lodash').runInContext(),
	require('./bolt/array'),
	require('./bolt/object'),
	require('./bolt/function'),
	require('./bolt/string')
);

const fs = require('fs');
const gulp = require('gulp');
const path = require('path');

const xIsJsFile = /\.js$/i;
const xRollupPluginTest = /^rollup[A-Z0-9]/;
const xIsDigit = /^\d+$/;


initSettings();
const tasks = createTasks(path.resolve(process.cwd(), settings.gulpTasksDir || './tasks'));

function processSettings(obj, parent, parentProp) {
	let allNumbers = true;
	Object.keys(obj).forEach(propName=>{
		allNumbers = allNumbers && xIsDigit.test(propName);
	});

	if (allNumbers && parent && parentProp) {
		parent[parentProp] = Object.keys(obj).map(propName=>obj[propName]);
	} else {
		Object.keys(obj).forEach(propName=>{
			const value = obj[propName];
			if (bolt.isObject(value)) processSettings(value, obj, propName);
		});
	}
}

function initSettings() {
	const cmdArgvs = require('yargs').argv;
	const cmdArgvSettings = {};
	if (cmdArgvs && cmdArgvs.settings) {
		processSettings(Object.assign(cmdArgvSettings, cmdArgvs.settings));
		delete cmdArgvs.settings;
	}

	global.settings = Object.assign(
		global.settings || {},
		loadConfig(),
		cmdArgvs,
		cmdArgvSettings
	);
	global.settings.boltRootDir = global.settings.boltRootDir || global.settings.cwd;
}

/**
 * Load config properties from package.json of module.
 *
 * @param {string} id                   Id in package.json to grab from.
 * @param {Array} copyProps             Properties to get.
 * @param {Object} defaultPropValues    Default values to apply.
 * @returns {Object}                    The config.
 */
function loadConfig(id='gulp', copyProps=[], defaultPropValues={}) {
	const packageData = getPackageData();
	const selectedPackageData = packageData[id] || {};

	return bolt.substituteInObject(Object.assign(
		...copyProps.map((prop, n)=>{
			if (defaultPropValues.length > n) return {[prop]:defaultPropValues[n]};
		}), {
			cwd: __dirname,
			nodeVersion: parseFloat(process.versions.node.split('.').slice(0, 2).join('.'))
		},
		selectedPackageData,
		bolt.pickDeep(packageData, copyProps.concat(selectedPackageData.copyProps || [])),
		getPackageData(selectedPackageData.local || '/local.json')
	));
}

/**
 * Get the package file without error-ing on fail,
 *
 * @param {string} [filename='package.json']    Package source name.
 * @returns {Object}                            The package file.
 */
function getPackageData(filename) {
	filename = filename || '/package.json';
	try {
		return require(__dirname + filename);
	} catch(err) {
		return {};
	}
}

/**
 * Get a tree structure from a directory with given root.  Returns required files if files is .js.
 *
 * @param {string} root		The starting directory.
 * @returns {Object}		The structure.
 */
function tree(root) {
	var structure = {};

	var _files = fs.readdirSync(root);
	for(var i=0; i<_files.length; i++) {
		if ((_files[i] !== '.') && (_files[i] !== '..')) {
			var stats = fs.statSync(root + '/' + _files[i]);
			if (stats.isDirectory()) {
				structure[_files[i]] = tree(root + '/' + _files[i]);
			} else if (stats.isFile() && xIsJsFile.test(_files[i])) {
				try {
					const path = `${root}/${_files[i]}`;
					structure[_files[i]] = Object.assign(require(path), {path});
				} catch(err) {
					console.log('Could not load task in: ' + _files[i]);
					console.error(err);
				}
			}
		}
	}

	return _parseTree(structure);
}

function _parseTree(tree) {
	for (var id in tree) {
		if (Array.isArray(tree[id])) tree[id] = {deps: tree[id]};
		if (bolt.isFunction(tree[id])) {
			tree[id] = {fn: tree[id]};
			tree[id].deps = tree[id].fn.deps || [];
		}
		if (tree[id].watch) tree[id].fn = function (gulp) {
			gulp.watch(tree[id].watch.source, tree[id].watch.tasks);
		};
		if (tree[id].deps || tree[id].fn) {
			tree[id].fn = tree[id].fn || function (done) {done();};
			tree[id].deps = tree[id].deps || [];
		}
	}

	return tree;
}

/**
 * Add an id to a parent to get a new full id.
 *
 * @param {string} parent		The parent id.
 * @param {string} id			The id.
 * @returns {string}			The full id.
 */
function parentId(parent, id) {
	return parent + id.replace(xIsJsFile, '');
}

function getInjection(func, inject) {
	return bolt.parseParameters(func).map(param=>getModule(param, inject));
}

/**
 * Try to load a module represented by given paramter name.
 *
 * @throws {RangeError}							Throws when module not available for given parameter name.
 * @param {string|Array.<string>} paramName		Parameter name to load module for. If array, load for each and
 * 												return an array.
 * @param {Object} inject						Inject object to use.
 * @returns {*}									Module for given parameter name.
 */
function getModule(paramName, inject) {
	if (Array.isArray(paramName)) return paramName.map(paramName=>getModule(paramName, inject));
	if (paramName in (settings.injectionMapper || {})) paramName = (settings.injectionMapper || {})[paramName];
	if (inject.hasOwnProperty(paramName) && !bolt.isString(inject[paramName])) return inject[paramName];

	const moduleId = (
		(inject.hasOwnProperty(paramName) && bolt.isString(inject[paramName])) ?
			inject[paramName] :
		'gulp-' + bolt.kebabCase(paramName)
	);

	try {
		return require(moduleId);
	} catch(err) {
		try {
			if (xRollupPluginTest.test(paramName)) {
				try {
					const moduleId = bolt.kebabCase(paramName).replace('rollup-','rollup-plugin-');
					return require(moduleId);
				} catch(err) {}
			}
			return require(bolt.kebabCase(paramName));
		} catch(err) {
			console.error(err);
			throw new RangeError(`Could not inject module for ${paramName}, did you forget to 'npm install' / 'yarn add' the given module.`)
		}
	}
}

/**
 * Given a tree structure, create an object of tasks-ids against task objects.
 *
 * @param {Object} tree				The directory tree from tree().
 * @param {string} [parent=""]		The current parent id.
 * @param {Object} [tasks={}]		The task object.
 * @returns {Object}				The flat object, tasks.
 */
function _createTasks(tree, parent, tasks) {
	parent = parent || "";
	tasks = tasks || {};

	for (var id in tree) {
		if (tree[id].deps || tree[id].fn || tree[id].watch) {
			tasks[parentId(parent, id)] = tree[id];
		} else {
			_createTasks(tree[id], parentId(parent, id) + ':', tasks)
		}
	}

	return _parseDeps(tasks);
}

function _replaceGlobDeps(tasks, searcher, depId) {
	var found = [];
	var finder = new RegExp(searcher[depId].replace('*', '.*?'));
	for(var id in tasks) {
		if (finder.test(id)) found.push(id);
	}
	if (!found.length) return depId;
	searcher.splice.apply(searcher, [depId, 1].concat(found));
	return (depId-1);
}

function _parseDeps(tasks) {
	for(var id in tasks) {
		for(var depNo=0; depNo < tasks[id].deps.length; depNo++) {
			if (tasks[id].deps[depNo].indexOf('*') !== -1) {
				depNo = _replaceGlobDeps(tasks, tasks[id].deps, depNo);
			}
		}
	}

	return tasks;
}

/**
 * Get the a tasks object from the given directory path.
 *
 * @param {string} root		The path to scan.
 * @returns {Object}		The tasks object created by _createTasks().
 */
function createTasks(root) {
	return _createTasks(tree(root));
}

function getTimeNowString() {
	const date = new Date();
	const [hours, minutes, seconds] = [date.getHours(), date.getMinutes(), date.getSeconds()];
	return `${(hours>9)?hours:`0${hours}`}:${(minutes>9)?minutes:`0${minutes}`}:${(seconds>9)?seconds:`0${seconds}`}`
}

/**
 * Create a gulp task for the given id.
 *
 * @param {string} taskId		Task id to lookup in tasks and assign.
 * @returns {Function}			The gulp function.
 */
function createTask(taskId) {
	return function (done) {
		console.log(`[${getTimeNowString()}] Found task '${taskId}' in ${tasks[taskId].fn.path}`);
		const stream = tasks[taskId].fn(...getInjection(tasks[taskId].fn, {gulp,done}));
		if (stream) {
			if (stream.on) stream.on('end', done);
			if (stream.then) stream.then(done);
		}
	};
}

for (var taskId in tasks) gulp.task(taskId, tasks[taskId].deps, createTask(taskId));

if (!module.parent && (process.argv.length > 2)) gulp.start([process.argv[2]]);
