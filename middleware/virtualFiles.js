'use strict';

const path = require('path');
const mime = require('mime');
const events = require('events');
const emitter = new events();

const virtualFiles = {};
const AWAIT = Symbol('Wait for file.');

class VirtualFile {
	constructor(contents, type) {
		this.contents = contents;
		this.type = type;
	}

	static get AWAIT() {
		return AWAIT;
	}
}
bolt.VirtualFile = VirtualFile;

function pathSpliter(path) {
	return path.split('/').filter(part=>part);
}

bolt.setVirtualFile = function(_path, contents, type) {
	const objPath = pathSpliter(_path);
	if (contents === VirtualFile.AWAIT) {
		bolt.set(virtualFiles, objPath, contents);
	} else {
		const _type = type || mime.getType(path.extname(_path));
		const file = new bolt.VirtualFile(contents, _type);
		bolt.set(virtualFiles, objPath, file);
		bolt.emit('newVirtualFile', _path);
		emitter.emit(_path, file, _type);
	}
};

bolt.getVirtualFile = function(path) {
	const objPath = pathSpliter(path);
	bolt.get(virtualFiles, objPath);
};


/**
 * Serve browser bolt files
 *
 * @public
 * @param {BoltApplication} app   The bolt application instance.
 */
function init(app) {
	// @annotation priority 7

	function sendFile(file, res) {
		if (file instanceof bolt.VirtualFile) return res
			.type(file.type)
			.status(200)
			.send(file.contents);

		if (file !== bolt.VirtualFile.AWAIT) return res
			.type(mime.getType(path.extname(req.path)))
			.status(200)
			.send(file);
	}

	app.get(/\/.*/, (req, res, next)=>{
		const objPath = pathSpliter(req.path);
		const file = bolt.get(virtualFiles, objPath);
		if (file) {
			if (file === VirtualFile.AWAIT) return emitter.once(req.path, file=>sendFile(file, res));
			return sendFile(file, res);
		}
		next();
	});
}

module.exports = init;
