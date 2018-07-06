'use strict';

const path = require('path');
const fs = require('fs');

const xPathSep = new RegExp(`\\${path.sep}`, 'g');


function checkCache(app, event) {
	const cacheDir = path.join(boltRootDir, 'cache', app.config.name, 'jsx');
	const cacheFileName = path.join(cacheDir, `cache${event.target.replace(xPathSep, '-')}.js`);

	try {
		const statCache = fs.statSync(cacheFileName);
		const statTarget = fs.statSync(event.target);

		if (statCache.mtimeMs > statTarget.mtimeMs) {
			event.data.target = cacheFileName;
			bolt.__transpiled.set(event.target, cacheFileName);
		}
	} catch(err) {
		console.error(err);
	}

}

module.exports = function() {
	// @annotation key loadRootHooks
	// @annotation when after

	bolt.__transpiled = new Map();
	return app=>bolt.on('moduleLoadJsx', event=>checkCache(app, event));
};