'use strict';

const fs = require('fs');
const path = require('path');
const {provideBolt, loadBoltModule, loadLibModule} = require('./loaders');

const exts = new Set(['.mjs', '.js']);
const loadedAnnotationPaths = new Set();


function init(parent, boltLoaded) {
	Error.stackTraceLimit = Infinity;
	Object.assign(global, {__originalCwd:process.cwd(), startTime:process.hrtime()});
	process.chdir(path.dirname(fs.realpathSync(parent)));
	return _getBolt(parent, boltLoaded);
}

function _getBolt(parent, boltLoaded) {
	const requireX = require('require-extra')
		.set('followHardLinks', true)
		.set('useCache', true)
		.set('parent', parent);

	const parentDir = path.dirname(parent);
	const bolt = Object.assign(
		requireX.sync("lodash").runInContext(),
		{
			require: requireX,
			annotation: new (requireX.sync('@simpo/object-annotations'))(),
			__paths: new Set([parentDir])
		}
	);

	provideBolt(bolt);
	_initLoader(bolt, parentDir, boltLoaded);

	return bolt;
}

function _readDirSync(dirPath) {
	try {
		return fs.readdirSync(dirPath);
	} catch(err) {}

	return [];
}

function _importSync(bolt, dirPath) {
	const done = new Set();

	return bolt.chain(_readDirSync(dirPath))
		.filter(filePath=>((filePath !== '.') && (filePath !== '..') && exts.has(path.extname(filePath))))
		.map(filePath=>{
			const fileName = path.basename(filePath, path.extname(filePath));
			if (done.has(fileName)) return; // Node style if my-module.mjs loaded, do not load my-module.js
			const fullFilePath = path.join(dirPath, filePath);
			try {
				const parser = bolt.require.sync(fullFilePath);
				if (parser) {
					done.add(fileName);
					const parsers = [...(bolt.isFunction(parser)?[parser]:(bolt.isObject(parser)? parser.values : []))];
					parsers.forEach(parser=>bolt.annotation.set(parser, 'filePath', fullFilePath));
					return parsers;
				}
			} catch(err) {}
		})
		.flatten()
		.filter(parser=>parser)

}

function loadAnnotations(bolt, root) {
	if (Array.isArray(root)) return bolt.chain(root)
		.map(root=>loadAnnotations(bolt, root))
		.flatten()
		.value();

	// Ensure annotations are not loaded twice.
	const annotationsPath = path.join(root, 'annotations');
	if (loadedAnnotationPaths.has(annotationsPath)) return bolt.chain([]);
	loadedAnnotationPaths.add(annotationsPath);

	_importSync(bolt, annotationsPath)
		.forEach(parser=>{
			bolt.annotation.addParser(parser);
			bolt.waitEmit(
				'initialiseApp', 'addAnnotationParser',
				bolt.annotation.get(parser, 'filePath'),
				bolt.annotation.get(parser, 'key')
			);
		})
		.value();
}

function _initLoader(bolt, parentDir, boltLoaded) {
	const {createPlatformScope, boltRequireXLoader} = loadLibModule(['platformScope', 'requirex']);
	createPlatformScope(bolt, parentDir, [loadBoltModule, loadLibModule]);
	Object.assign(bolt, loadBoltModule('event'));
	loadAnnotations(bolt, parentDir);
	bolt.BoltModuleReadyEvent = class BoltModuleReadyEvent extends bolt.Event {};
	boltRequireXLoader(bolt, boltLoaded);

	return bolt;
}

module.exports = {
	init, loadAnnotations
};