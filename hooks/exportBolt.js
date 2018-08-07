'use strict';

module.exports = function() {
	// @annotation key boltBrowserCompiled
	// @annotation once

	return ({app, name})=>setImmediate(async ()=>{
		const cacheDir = bolt.getCacheDir(app);

		bolt.runGulp('bolt', app, [
			`--outputName=${name}`,
			`--cacheDir=${cacheDir}`
		]);
	});
};