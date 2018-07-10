'use strict';

const path = require('path');
const fs = require('fs');

const xPathSep = new RegExp(`\\${path.sep}`, 'g');
const statCompileScript = fs.statSync(require.resolve('./compileJsxTemplates.js'));
const stateCompileHere = fs.statSync(__filename);


function checkCache(event) {
	const cacheDir = path.join(boltRootDir, 'cache', 'jsx');
	const cacheFileName = path.join(cacheDir, `cache${event.target.replace(xPathSep, '-')}.js`);

	try {
		const statCache = fs.statSync(cacheFileName);
		const statTarget = fs.statSync(event.target);

		if (statCache.mtimeMs > Math.max(statTarget.mtimeMs, statCompileScript.mtimeMs, stateCompileHere.mtimeMs)) {
			event.data.target = cacheFileName;
			bolt.__transpiled.set(event.target, cacheFileName);
		}
	} catch(err) {

	}

}

module.exports = function() {
	// @annotation key moduleLoadJsx

	bolt.__transpiled = new Map();
	return event=>checkCache(event);
};