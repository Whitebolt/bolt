'use strict';
// @annotation zone server manager gulp

/**
 * @module bolt/bolt
 */


const _fs = Object.assign({}, require('fs'));
if (Object.getOwnPropertyDescriptor(_fs, 'promises')) {
	Object.defineProperty(_fs, 'promises', {
		get() {return _fs.promises}
	});
}
const Bluebird = require('bluebird');
const util = require('util');
const path = require('path');
const fs = {};
const exec = util.promisify(require('child_process').exec);
const _readDir = (!!_fs.promises ? _fs.promises.readdir : util.promisify(_fs.readdir));
const _lstatPromise = util.promisify(_lstat);
const _isFilePromise = util.promisify(_isFile);
const _isDirectoryPromise = util.promisify(_isDirectory);
if (!bolt.stores) throw new Error('Stores need to load first!');
const {statDir, statFile, readDirCache, lStatCache, statCache} = bolt.stores;


const xIsSync = /Sync$/;

bolt.forOwn(_fs, (method, methodName)=>{
	if (bolt.isFunction(method) && !xIsSync.test(methodName) && !_startsWithUpperCase(methodName)) {
		fs[methodName] = util.promisify(method);
	}
});

fs.readdir = async function readDir(dir) {
	if (readDirCache.has(dir)) {
		const results = readDirCache.get(dir);
		if (!results[0]) return results[1];
		return Promise.reject(results[0]);
	}

	try {
		const files = await _readDir(dir);
		readDirCache.set(dir, [null, files]);
		return files;
	} catch(err) {
		readDirCache.set(dir, [err, undefined]);
		return Promise.reject(err);
	}
};

fs.lstat = function lstat(file, cb) {
	if (cb) return _lstat(file, cb);
	return _lstatPromise(file);
};

function __lstat(file, cb) {
	_fs.lstat(file, (err, stat)=>{
		lStatCache.set(file, [err, stat]);
		if (!err) {
			if (!stat.isSymbolicLink()) statCache.set(file, [null, stat]);
			return cb(null, stat);
		}
		return cb(err, null);
	});
}

function _lstat(file, cb) {
	if (lStatCache.has(file)) return cb(...lStatCache.get(file));
	const parent = path.dirname(file);
	if (parent !== file) return isDirectory(parent, (err, isDir)=>{
		if (!!err) {
			lStatCache.set(file, [err, null]);
			return cb(err, null);
		} else if (!isDir) {
			const _err = new Error('No parent directory');
			lStatCache.set(file, [err, null]);
			return cb(err, null);
		}
		return __lstat(file, cb);
	});
	return __lstat(file, cb);
}

function statAction(err, stat, cb) {
	if (!err) return (!!cb?cb(null, stat):stat);
	if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return (!!cb?cb(null, false):false);
	return (!!cb?cb(err):err);
}

function isDirectory(dir, cb) {
	if (cb) return _isDirectory(dir, cb);
	return _isDirectoryPromise(dir);
}

function __isDirectory(dir, cb) {
	fs.lstat(dir, function(err, stat) {
		if (!err) {
			statDir.set(dir, [null, stat.isDirectory()]);
			if (!stat.isSymbolicLink()) statCache.set(dir, [null, stat]);
			return statAction(null, statDir.get(dir)[1], cb);
		}
		statDir.set(dir, [err, null]);
		return statAction(err, null, cb);
	});
}

function _isDirectory(dir, cb) {
	if (statDir.has(dir)) return statAction(...statDir.get(dir), cb);
	const parent = path.dirname(dir);
	if (parent !== dir) return isDirectory(parent, (err, isDir)=>{
		if (!!err) {
			statDir.set(dir, [err, null]);
			return statAction(err, null, cb);
		} else if (!isDir) {
			statDir.set(dir, [null, false]);
			return statAction(null, false, cb);
		}
		return __isDirectory(dir, cb);
	});
	return __isDirectory(dir, cb);
}


function isFile(file, cb) {
	if (cb) return _isFile(file, cb);
	return _isFilePromise(file);
}

async function fileExists(filePath) {
	try {
		if (await isDirectory(filePath)) return true;
		if (await isFile(filePath)) return true;
	} catch(err) {}
	return false;
}

function __isFile(file, cb) {
	fs.lstat(file, function(err, stat) {
		if (!err) {
			statFile.set(file, [null, stat.isFile() || stat.isFIFO()]);
			if (!stat.isSymbolicLink()) statCache.set(file, [null, stat]);
			return statAction(null, statFile.get(file)[1], cb);
		}
		statFile.set(file, [err, null]);
		return statAction(err, null, cb);
	});
}

function _isFile(file, cb) {
	if (statFile.has(file)) return statAction(...statFile.get(file), cb);
	const parent = path.dirname(file);
	if (parent !== file) return isDirectory(parent, (err, isDir)=>{
		if (!!err) {
			statFile.set(file, [err, null]);
			return statAction(err, null, cb);
		} else if (!isDir) {
			statFile.set(file, [null, false]);
			return statAction(null, false, cb);
		}
		return __isFile(file, cb);
	});

	return __isFile(file, cb);
}

function _startsWithUpperCase(txt) {
	return (txt[0] === txt[0].toUpperCase());
}

/**
 * Get the root directory full path from the process arguments.  The root is
 * where the application was called from.
 *
 * @todo  How robust is this? How much better than using __dirname.  What happens when app called from a different directory?
 *
 * @public
 * @returns {string}    The root file path.
 */
function getRoot() {
	return path.dirname(process.argv[1]);
}

/**
 * Get the filename of the function, which called the function calling
 * this method.  Use stack trace to achieve this.
 *
 * @todo  Is this robust? Needs testing in multiple circumstances.
 *
 * @public
 * @returns {string}    The file name of the calling function.
 */
function getCallerFileName() {
	let prepareStackTrace = Error.prepareStackTrace;
	let err = new Error();
	let callerfile;
	let currentfile;

	try {
		Error.prepareStackTrace = (err, stack) => stack;
		currentfile = err.stack.shift().getFileName();
		while (err.stack.length) {
			let level = err.stack.shift();
			callerfile = level.getFileName();
			if(callerfile && (currentfile !== callerfile)) break;
		}
	} catch (err) {
	}

	Error.prepareStackTrace = prepareStackTrace;
	return callerfile;
}

/**
 * Find all the directories within a set of directories, which matches a given
 * filter.  Can be passed one directory or an array of directories.
 *
 * @todo  Needs fully testing and perhaps there is a more robust better way to do this, which allows for better options too.
 *
 * @public
 * @param {Array|string} dirPath    Path(s) to search.
 * @param {string} dirNameToFind    Name of directories to return.
 * @returns {Bluebird}               The found directories.
 */
async function directoriesInDirectory(dirPath, dirNameToFind) {
	const dirs = await ((Array.isArray(dirPath)) ?
		_directoriesInDirectories(dirPath) : _directoriesInDirectory(dirPath)
	);

	return dirs.filter(dirPath => {
		return (dirNameToFind && dirNameToFind.length) ?
		dirNameToFind.indexOf(path.basename(dirPath)) !== -1 :
			true;
	});
}

/**
 * Get a list of directories within the directories supplied. Will return a
 * promise resolving to the found directories.
 *
 * @private
 * @param {Array|string} dirPaths   Path(s) to search.
 * @returns {Bluebird}               Found directories.
 */
async function _directoriesInDirectories(dirPaths) {
	const dirs = await Promise.all(dirPaths.map(dirPath=>directoriesInDirectory(dirPath)));
	return bolt.flattenDeep(dirs);
}

/**
 * Get a list of directories within the directory supplied. Will return a
 * promise resolving to the found directories. Unlike,
 * _directoriesInDirectories() it will not search a list of directories just
 * the one supplied. Will return a promise resolving to the found directories.
 *
 * @private
 * @param {string} dirPath    Path to search.
 * @returns {Bluebird}         Found directories.
 */
async function _directoriesInDirectory(dirPath) {
	try {
		const files = (await fs.readdir(dirPath)).map(_mapJoin(dirPath));
		const dirs = files.filter(async (fileName)=>{
			try {
				const stat = await fs.lstat(fileName);
				return stat.isDirectory();
			} catch (errror) {
				return false;
			}
		});
		return dirs.map(_mapResolve(dirPath));
	} catch(error) {
		return [];
	}
}

function _mapJoin(dirPath) {
	return filename => path.join(dirPath, filename);
}

function _mapResolve(dirPath) {
	return filename=>path.resolve(dirPath, filename);
}

/**
 * Find the files in given directory with the given extension.
 *
 * @todo  Add better filter on multiple extension types and/or other criteria.
 *
 * @public
 * @param {string|Array.<string>} dirPath      	Path(s) to search.
 * @param {string} [ext='js']   				Filter files based on this extension.
 * @returns {Bluebird}          				 	Bluebird resoving to found files.
 */
async function filesInDirectory(dirPath, ext = 'js') {
	if (!Array.isArray(dirPath)) _filesInDirectory(dirPath, ext);
	const files = await Promise.all(dirPath.map(dirPath=>_filesInDirectory(dirPath, ext)))
	return bolt.flattenDeep(files);
}

async function _filesInDirectory(dirPath, ext) {
	let xExt = new RegExp('\.' + ext);

	try {
		const files = await fs.readdir(dirPath);
		return bolt.chain(files)
			.filter(fileName => xExt.test(fileName))
			.map(_mapResolve(dirPath))
			.value();
	} catch(error) {
		return [];
	}
}

function isPathRelativeTo(testPath, isRelativeTo) {
	const xRelativeToDir = new RegExp('^' + path.normalize(isRelativeTo).replace('/', '\/'));
	return xRelativeToDir.test(path.normalize(testPath));
}

async function makeDirectory(dir) {
	const ancestors = _getAncestors(dir);

	await bolt.mapAsync(ancestors, async (dir)=>{
		try {
			if (!(await fileExists(dir))) await fs.mkdir(dir);
		} catch(error) {}
	});
}

function _getAncestors(dir) {
	const sep = path.sep;
	const pathParts = dir.split(sep);
	const ancestors = [];

	for (let n=0; n<pathParts.length; n++) {
		ancestors.push(`${ancestors[ancestors.length-1]||''}${sep}${pathParts[n]}`.replace('//','/'));
	}

	return ancestors;
}

async function grant(dir, uid, gid) {
	const ancestors = _getAncestors(dir);
	ancestors.shift();
	await bolt.mapAsync(ancestors, async (dir)=>{
		try {
			console.log(`Granting ${uid}/${gid} to ${dir}`);
			await exec(`setfacl -RLm "u:${uid}:rx,g:${gid}:rx" ${dir}`);
		} catch(error) {
			console.log(error);
		}
	});
}

module.exports = {
	directoriesInDirectory: (...params)=>Bluebird.resolve(directoriesInDirectory(...params)),
	fileExists,
	filesInDirectory: (...params)=>Bluebird.resolve(filesInDirectory(...params)),
	fs,
	getCallerFileName,
	getRoot,
	grant,
	isPathRelativeTo,
	makeDirectory
};