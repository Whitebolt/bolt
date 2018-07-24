'use strict';

const {clearCache} = loadLibModule('build');

module.exports = function() {
	// @annotation key reduxBoltBrowserCompiled
	// @annotation once

	return ({app, name, filesId})=>setImmediate(async ()=>{
		const cacheDir = bolt.getCacheDir(app);

		bolt.runGulp('redux', app, [
			`--outputName=${name}`,
			`--boltRootDir=${boltRootDir}`,
			`--cacheDir=${cacheDir}`
		]);

		clearCache(filesId);
	});
};