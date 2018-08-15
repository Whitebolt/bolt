'use strict';
// @annotation zone server gulp


const promisify = require('util').promisify || Promise.promisify;
const path = require('path');
const fs = {...require('fs')};
const trimEnd  = bolt.memoize2(bolt.trimEnd);


if (Object.getOwnPropertyDescriptor(fs, 'promises')) Object.defineProperty(fs, 'promises', {
	get() {return fs.promises}
});

const fileMemoizeResolver = _path=>trimEnd(_path, path.sep);


const {stat, statSync} = createStatMethods();
const {lstat, lstatSync} = createLstatMethods();
const {isDirectory, isDirectorySync} = createIsDirectoryMethods();
const {isFile, isFileSync} = createIsFileMethods();
const {readdir, readdirSyc} = createReadDirMethods();
const {writeFile, writeFileSync} = createWriteFileMethods();
const {openFile, openFileSync} = createOpenMethods();
const {readFile, readFileSync} = createReadFileMethods();


function createStatMethods() {
	const cache = bolt.getStore('require.statCache');
	const _stat = bolt.memoize2(fs.stat, {cache, resolver:fileMemoizeResolver, type:'node-callback'});
	const statSync = bolt.memoize2(fs.statSync, {cache, resolver:fileMemoizeResolver});
	const statPromise = bolt.memoize2(!!fs.promises?fs.promises.stat:promisify(fs.stat), {cache, resolver:fileMemoizeResolver, type:'promise'});
	const stat = (file, cb)=>(!cb?statPromise(file):_stat(file, cb));

	return {stat, statSync};
}

function createLstatMethods() {
	const cache = bolt.getStore('require.statCache');
	const statCache = bolt.getStore('require.lStatCache');

	const _lstat = bolt.memoize2((file, cb)=>fs.lstat(file, (err, stat)=>{
		if (!err && !stat.isSymbolicLink() && !!statCache) statCache.set(file, [null, stat]);
		return cb(err, stat);
	}), {cache, resolver:fileMemoizeResolver, type:'node-callback'});
	const lstatSync = bolt.memoize2(file=>{
		const stat = fs.lstatSync;
		if (!stat.isSymbolicLink() && !!statCache) statCache.set(file, [null, stat]);
		return stat;
	}, {cache, resolver:fileMemoizeResolver});
	const lstatPromise = bolt.memoize2(!!fs.promises?fs.promises.lstat:promisify(fs.lstat), {cache, resolver:fileMemoizeResolver, type:'promise'});
	const lstat = (file, cb)=>(!cb?lstatPromise(file):_lstat(file, cb));

	return {lstat, lstatSync};
}

const _testParentDirectory = (parent, doStat, file, cb)=>isDirectory(parent, (err, isDir)=>{
	if (!!err) return cb(err, null);
	if (!isDir) return cb(null, false);
	return doStat(file, cb);
});

function createIsFileMethods() {
	const cache = bolt.getStore('require.statFile');

	const doStat = (file, cb)=>stat(file, (err, stat)=>{
		if (!err) return cb(null, stat.isFile() || stat.isFIFO());
		if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return cb(null, false);
		return cb(err);
	});

	const _isFile = bolt.memoize2((file, cb)=>{
		const parent = path.dirname(file);
		if (parent === path) return doStat(file, cb);
		return _testParentDirectory(parent, doStat, file, cb);
	}, {cache, resolver:fileMemoizeResolver});

	const isFileSync = bolt.memoize2(file=>{
		try {
			const parent = path.dirname(file);
			if ((parent !== file) && !isDirectorySync(parent)) return false;
			const stat = statSync(file);
			return stat.isFile() || stat.isFIFO();
		} catch (err) {
			if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return false;
			throw err;
		}
	}, {cache, resolver:fileMemoizeResolver, type:'node-callback'});
	const isFilePromise = bolt.memoize2(promisify(_isFile), {cache, resolver:fileMemoizeResolver, type:'promise'});
	const isFile = (file, cb)=>(!cb?isFilePromise(file):_isFile(file, cb));

	return {isFile, isFileSync};
}

function createIsDirectoryMethods() {
	const cache = bolt.getStore('require.statDir');

	const doStat = (dir, cb)=>stat(dir, (err, stat)=>{
		if (!err) return cb(null, stat.isDirectory());
		if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return cb(null, false);
		return cb(err);
	});

	const _isDirectory = bolt.memoize2((dir, cb)=>{
		const parent = path.dirname(dir);
		if (parent === dir) return doStat(dir, cb);
		return _testParentDirectory(parent, doStat, dir, cb);
	}, {cache, resolver:fileMemoizeResolver, type:'node-callback'});

	const isDirectorySync = bolt.memoize2(dir=>{
		try {
			const parent = path.dirname(dir);
			if ((parent !== dir) && !isDirectorySync(parent)) return false;
			const stat = statSync(dir);
			return stat.isDirectory();
		} catch (err) {
			if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return false;
			throw err;
		}
	}, {cache, resolver:fileMemoizeResolver});
	const isDirectoryPromise = bolt.memoize2(promisify(_isDirectory), {cache, resolver:fileMemoizeResolver, type:'promise'});
	const isDirectory = (dir, cb)=>(!cb?isDirectoryPromise(dir):_isDirectory(dir, cb));

	return {isDirectory, isDirectorySync};
}

function createReadDirMethods() {
	const cache = bolt.getStore('require.readDirCache');
	const _readdir = bolt.memoize2(fs.readdir, {cache, type:'node-callback'});
	const readdirSync = bolt.memoize2(fs.readdirSync, {cache});
	const readdirPromise = bolt.memoize2(!!fs.promises?fs.promises.readdir:promisify(fs.readdir), {cache, type:'promise'});
	const readdir = (file, cb)=>(!cb?readdirPromise(file):_readdir(file, cb));

	return {readdir, readdirSync};
}

function createReadFileMethods() {
	const cache = bolt.getStore('require.readFileCache');

	const _readFile = bolt.memoize2(fs.readFile, {cache, type:'node-callback'});
	const _readFileSync = bolt.memoize2(fs.readFileSync, {cache});
	const readFileStream = bolt.memoize2(fs.createReadStream, {cache, type:'stream'});
	const readFilePromise = bolt.memoize2(!!fs.promises?fs.promises.readFile:promisify(fs.readFile), {cache, type:'promise'});

	function mergeResult(result, encoding) {
		if (!Array.isArray(result)) return ((encoding === null)?result:result.toString(encoding));
		if (encoding === null) return Buffer.concat(result);
		return Buffer.concat(result).toString(encoding);
	}

	function readFile(path, ...params) {
		const cb = ((params.length > 1)?params[1]:(bolt.isFunction(params[0])?params[0]:undefined));
		const last = bolt.nth(params, -1);
		const {stream=false, ...options} = {...(
			bolt.isObject(last) ?
				params.pop() :
				(bolt.isString(last) ? {encoding:last} : '')
		)};
		const encoding = options.encoding || null;
		options.encoding = null;

		if (!stream) return (!!cb?
			_readFile(path, options, (err, result)=>{
				if (!!err) return cb(err);
				return cb(err, mergeResult(result, encoding));
			}) : readFilePromise(path, options).then(result=>mergeResult(result, encoding))
		);
		return readFileStream(path, options);
	}
	readFile.cache = cache;

	function readFileSync(path, options={}) {
		const _options = (bolt.isString(options) ? {encoding:options} : options);
		const encoding = _options.encoding || null;
		_options.encoding = null;
		return mergeResult(_readFileSync(path, options), encoding);
	}
	readFileSync.cache = cache;

	return {readFile, readFileSync};
}

function createWriteFileMethods() {
	const writeFilePromise = !!fs.promises?fs.promises.writeFile:promisify(fs.writeFile);
	const writePromise = !!fs.promises?fs.promises.write:promisify(fs.write);
	const writeFile = async (file, data, ...params)=>{
		const cb = (bolt.isFunction(bolt.nth(params, -1)) ? params.pop() : undefined);
		const options = {...(bolt.isObject(bolt.nth(params, -1)) ? params.pop() : {})};

		if (!!options.createDirectories) await bolt.makeDirectory(path.dirname(file));
		if (!!options.json && bolt.isObject(data)) data = JSON.stringify(data);

		if (bolt.isNumber(params[0])) {
			if (!!cb) return fs.write(file, data, ...[...params, cb]);
			return writePromise(file, data, ...params);
		} else {
			if (!!cb) return fs.writeFile(file, data, bolt.omit(options, ['createDirectories']), cb);
			return writeFilePromise(file, data, bolt.omit(options, ['createDirectories']));
		}

	};
	const writeFileSync = (file, data, ...params)=>{
		const options = {...(bolt.isObject(bolt.nth(params, -1)) ? params.pop() : {})};
		if (!!options.createDirectories) bolt.makeDirectorySync(path.dirname(file));

		if (bolt.isNumber(params[0])) return fs.writeSync(file, data, ...params);
		return fs.writeFileSync(file, data, bolt.omit(options, ['createDirectories']));
	};

	return {writeFile, writeFileSync};
}

function createOpenMethods() {
	const openPromise = !!fs.promises?fs.promises.open:promisify(fs.open);

	const openFile = async (_path, flags, ...params)=>{
		const cb = (bolt.isFunction(bolt.nth(params, -1)) ? params.pop() : undefined);
		const options = {...(bolt.isObject(bolt.nth(params, -1)) ? params.pop() : {})};

		if (!!options.createDirectories) await bolt.makeDirectory(path.dirname(_path));

		if (!!cb) return fs.open(_path, flags, ...[...params, cb]);
		return openPromise(_path, flags);
	};

	const openFileSync = (_path, flags, ...params)=>{
		const options = {...(bolt.isObject(bolt.nth(params, -1)) ? params.pop() : {})};
		if (!!options.createDirectories) bolt.makeDirectorySync(path.dirname(_path));
		return fs.openSync(_path, flags, ...params);
	};

	return {openFile, openFileSync};
}


module.exports = {
	stat, statSync, lstat, lstatSync, isDirectory, isDirectorySync, isFile, isFileSync, readdir, readdirSyc,
	writeFile, writeFileSync, openFile, openFileSync, readFile, readFileSync
};
