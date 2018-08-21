'use strict';

const path = require('path');
const through = require('through2');

const xBreakingInCSPGetGlobal = /Function\(["']return this["']\)\(\)/g;
const cspReplace = 'window';

function gulpBoltBrowser(options={}) {
	return through.obj(function (file, encoding, callback) {
		let contents = options.top || '';
		// So CSP does not break, it is always browser anyway.
		contents += file.contents.toString().replace(xBreakingInCSPGetGlobal, cspReplace);
		contents += options.tail || '';
		file.contents = Buffer.from(contents);
		return callback(null, file);
	});
}

module.exports = gulpBoltBrowser;
