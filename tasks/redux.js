'use strict';

const path = require('path');
const fs = require('fs');
const rollupMemoryPlugin = require('../lib/rollupMemoryPlugin');
const cacheId = 'gulpBolt';

const xBreakingInCSPGetGlobal = /Function\(["']return this["']\)\(\)/g;
const cspReplace = 'window';


function fn(
	gulp, sourcemaps, ignore, uglifyEs, rename, rollupBabel, rollupNodeResolve, rollupPluginCommonjs, rollupPluginJson,
	settings, replaceWithSourcemaps, done, rollup, rollupVinylAdaptor
) {
	const webPath = 'lib';
	const waiting = {current:2};
	const config = {...settings, ...(require(path.join(settings.cwd, 'package.json')).config || {})};
	const dest = path.join(config.boltRootDir, 'private', config.name, webPath);
	const cacheDir = path.join(config.boltRootDir, 'cache', config.name);

	rollupVinylAdaptor({
		rollup,
		input: {
			//cache: bolt.getRollupBundleCache({cacheDir, id:cacheId}),
			input: {
				contents:config.contents,
				contentsPath:config.contentsPath,
				path:path.join(config.cwd, `${config.outputName}.js`)
			},
			plugins: [
				rollupMemoryPlugin(),
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
						'@babel/plugin-external-helpers',
						'@babel/transform-react-jsx',
						['@babel/plugin-proposal-decorators', {legacy:true}],
						['@babel/plugin-proposal-class-properties', {loose:true}],
						...bolt.get(config, 'browserExport.babel.plugins', [])
					]
				})
			]
		},
		output: {
			format: 'iife',
			name: settings.outputName,
			sourcemap: true
		}
	})
		.on('bundle', bundle=>bolt.saveRollupBundleCache({bundle, cacheDir, id:cacheId, waiting, done}))
		.pipe(sourcemaps.init({loadMaps: true}))
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