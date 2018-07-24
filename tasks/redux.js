'use strict';

const path = require('path');
const fs = require('fs');
const rollupMemoryPlugin = require('../lib/rollupMemoryPlugin');
const cacheId = 'gulpBolt';

const xBreakingInCSPGetGlobal = /Function\(["']return this["']\)\(\)/g;
const cspReplace = 'window';


function fn(
	gulp, sourcemaps, ignore, uglifyEs, rename, rollupBabel, rollupNodeResolve, rollupPluginCommonjs, rollupPluginJson,
	settings, replaceWithSourcemaps, done, rollup, rollupVinylAdaptor, babelResolveTransform
) {
	const webPath = 'lib';
	const waiting = {current:2};
	const config = {...settings, ...(require(path.join(settings.cwd, 'package.json')).config || {})};
	const dest = path.join(config.boltRootDir, 'public', 'dynamic', config.name, webPath);

	rollupVinylAdaptor({
		rollup,
		input: {
			//cache: bolt.getRollupBundleCache({cacheDir, id:cacheId}),
			input: path.join(config.cacheDir, `${config.outputName}.js`),
			plugins: [
				rollupNodeResolve({
					...bolt.get(config, 'browserExport.nodeResolve', {}),
					extensions:[
						'.jsx',
						...bolt.get(config, 'browserExport.nodeResolve.extensions', [])
					]
				}),
				rollupPluginCommonjs(),
				rollupPluginJson(),
				rollupBabel({
					generatorOpts: bolt.get(config, 'browserExport.babel.generatorOpts', {}),
					externalHelpers: true,
					sourceMaps: true,
					presets: bolt.get(config, 'browserExport.babel.presets', []),
					plugins: [
						babelResolveTransform(bolt.pick(config, ['root'])),
						'@babel/plugin-external-helpers',
						...bolt.get(config, 'browserExport.babel.plugins', [])
					]
				})
			]
		},
		output: {
			format: 'iife',
			name: config.outputName,
			sourcemap: true
		}
	})
		.on('bundle', bundle=>bolt.saveRollupBundleCache({bundle, cacheDir:config.cacheDir, id:cacheId, waiting, done}))
		.pipe(sourcemaps.init({loadMaps: true}))
		.pipe(rename(path=>{path.dirname = '';}))
		.pipe(replaceWithSourcemaps(xBreakingInCSPGetGlobal, cspReplace))
		.pipe(sourcemaps.write('./', {sourceMappingURLPrefix:`/${webPath}`}))
		.pipe(gulp.dest(dest))
		.pipe(ignore.exclude('*.map'))
		.pipe(uglifyEs.default({}))
		.pipe(rename(path=>{path.extname = '.min.js';}))
		.pipe(sourcemaps.write('./', {sourceMappingURLPrefix:`/${webPath}`}))
		.pipe(gulp.dest(dest))
		.on('end', ()=>bolt.waitCurrentEnd({waiting, done}));
}

module.exports = fn;