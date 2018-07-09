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

/*function gulpBoltBrowser(options={}) {
	return through.obj(function (file, encoding, callback) {
		const [top, bottom] = [options.top || '', (options.tail || '')+(options.bottom || '')];

		let content = file.contents.toString();
		const magic = new MagicString(content);

		let match = null;
		while ((match = xBreakingInCSPGetGlobal.exec(content)) !== null) {
			magic.overwrite(match.index, match.index + match[0].length, cspReplace);
		}
		if (top !== '') magic.prepend(top);
		if (bottom !== '') magic.append(bottom);

		let contents = magic.toString();
		contents += contents.replace(xBreakingInCSPGetGlobal, 'window');

		file.contents = Buffer.from(contents);
		const sourceMap = magic.generateMap({file:file.relative, source:file.relative});

		sourcemapsApply(file, sourceMap);
		return callback(null, file);
	});
}*/

module.exports = gulpBoltBrowser;
