'use strict';
// @annotation zone server

const promisify = require('util').promisify || Promise.promisify;
const path = require('path');
const fs = {...require('fs')};

if (Object.getOwnPropertyDescriptor(fs, 'promises')) Object.defineProperty(fs, 'promises', {
	get() {return fs.promises}
});


const {stat, statSync} = createStatMethods();
const {lstat, lstatSync} = createLstatMethods();
const {isDirectory, isDirectorySync} = createIsDirectoryMethods();
const {isFile, isFileSync} = createIsFileMethods();


function createStatMethods() {
	const cache = bolt.getStore('statCache');
	const _stat = bolt.memoizeNode(fs.stat, {cache});
	const statSync = bolt.memoize(fs.statSync, {cache});
	const statPromise = bolt.memoizePromise(!!fs.promises?fs.promises.stat:promisify(fs.stat), {cache});
	const stat = (file, cb)=>(!cb?statPromise(file):_stat(file, cb));

	return {stat, statSync};
}

function createLstatMethods() {
	const cache = bolt.getStore('statCache');
	const statCache = bolt.getStore('lStatCache');

	const _lstat = bolt.memoizeNode((file, cb)=>fs.lstat(file, (err, stat)=>{
		if (!err && !stat.isSymbolicLink() && !!statCache) statCache.set(file, [null, stat]);
		return cb(err, stat);
	}), {cache});
	const lstatSync = bolt.memoize(file=>{
		const stat = fs.lstatSync;
		if (!stat.isSymbolicLink() && !!statCache) statCache.set(file, [null, stat]);
		return stat;
	}, {cache});
	const lstatPromise = bolt.memoizePromise(!!fs.promises?fs.promises.lstat:promisify(fs.lstat), {cache});
	const lstat = (file, cb)=>(!cb?lstatPromise(file):_lstat(file, cb));

	return {lstat, lstatSync};
}

const _testParentDirectory = (parent, doStat, file, cb)=>isDirectory(parent, (err, isDir)=>{
	if (!!err) return cb(err, null);
	if (!isDir) return cb(null, false);
	return doStat(file, cb);
});

function createIsFileMethods() {
	const cache = bolt.getStore('statFile');

	const doStat = (file, cb)=>stat(file, (err, stat)=>{
		if (!err) return cb(null, stat.isFile() || stat.isFIFO());
		if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return cb(null, false);
		return cb(err);
	});

	const _isFile = bolt.memoizeNode((file, cb)=>{
		const parent = path.dirname(file);
		if (parent === path) return doStat(file, cb);
		return _testParentDirectory(parent, doStat, file, cb);
	}, {cache});

	const isFileSync = bolt.memoize(file=>{
		try {
			const parent = path.dirname(file);
			if ((parent !== file) && !isDirectorySync(parent)) return false;
			const stat = statSync(file);
			return stat.isFile() || stat.isFIFO();
		} catch (err) {
			if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return false;
			throw err;
		}
	}, {cache});
	const isFilePromise = bolt.memoizePromise(promisify(_isFile), {cache});
	const isFile = (file, cb)=>(!cb?isFilePromise(file):_isFile(file, cb));

	return {isFile, isFileSync};
}

function createIsDirectoryMethods() {
	const cache = bolt.getStore('statDir');

	const doStat = (dir, cb)=>stat(dir, (err, stat)=>{
		if (!err) return cb(null, stat.isDirectory());
		if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return cb(null, false);
		return cb(err);
	});

	const _isDirectory = bolt.memoizeNode((dir, cb)=>{
		const parent = path.dirname(dir);
		if (parent === dir) return doStat(dir, cb);
		return _testParentDirectory(parent, doStat, dir, cb);
	}, {cache});

	const isDirectorySync = bolt.memoize(dir=>{
		try {
			const parent = path.dirname(dir);
			if ((parent !== dir) && !isDirectorySync(parent)) return false;
			const stat = statSync(dir);
			return stat.isDirectory();
		} catch (err) {
			if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return false;
			throw err;
		}
	}, {cache});
	const isDirectoryPromise = bolt.memoizePromise(promisify(_isDirectory), {cache});
	const isDirectory = (dir, cb)=>(!cb?isDirectoryPromise(dir):_isDirectory(dir, cb));

	return {isDirectory, isDirectorySync};
}



module.exports = {
	stat, statSync, lstat, lstatSync, isDirectory, isDirectorySync, isFile, isFileSync
};
