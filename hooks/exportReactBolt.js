'use strict';

const {clearCache} = loadLibModule('build');

module.exports = function() {
	// @annotation key reactBoltBrowserCompiled
	// @annotation once

	return ({app, name, filesId, requireMap})=>setImmediate(async ()=>{
		const cacheDir = bolt.getCacheDir(app);

		bolt.runGulp('react', app, [
			`--outputName=${name}`,
			`--cacheDir=${cacheDir}`,
			...bolt.objectToArgsArray(requireMap, 'reactBoltMap')
		]);

		clearCache(filesId);
	});
};