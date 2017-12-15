'use strict';

const path = require('path');
const mime = require('mime');

const virtualFiles = {};

class VirtualFile {
	constructor(contents, type) {
		this.contents = contents;
		this.type = type;
	}
}
bolt.VirtualFile = VirtualFile;

function pathSpliter(path) {
	return path.split('/').filter(part=>part);
}

bolt.setVirtualFile = function(_path, contents, type) {
	const _type = type || mime.getType(path.extname(_path));
	const objPath = pathSpliter(_path);
	const file = new bolt.VirtualFile(contents, _type);
	bolt.set(virtualFiles, objPath, file);
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

	app.get(/\/.*/, (req, res, next)=>{
		const objPath = pathSpliter(req.path);
		const file = bolt.get(virtualFiles, objPath);
		if (file) {
			if (file instanceof bolt.VirtualFile) return res.type(file.type).status(200).send(file.contents);
			return res.type(mime.getType(path.extname(req.path))).status(200).send(file);
		}
		next();
	});
}

module.exports = init;
