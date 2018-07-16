'use strict';

const fs = require('fs');
const path = require('path');
const {provideBolt, loadBoltModule, loadLibModule} = require('./loaders');

const xSpaces = /\s+/;


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

function _initLoader(bolt, parentDir, boltLoaded) {
	bolt.annotation.addParser(value=>{
		// @annotation key zone
		return new Set([...value.split(xSpaces).map(zone=>zone.trim())]);
	});

	const {createPlatformScope, boltRequireXLoader} = loadLibModule(['platformScope', 'requirex']);
	createPlatformScope(bolt, parentDir, [loadBoltModule, loadLibModule]);
	Object.assign(bolt, loadBoltModule('event'));
	bolt.BoltModuleReadyEvent = class BoltModuleReadyEvent extends bolt.Event {};
	boltRequireXLoader(bolt, boltLoaded);

	return bolt;
}

module.exports = {
	init
};