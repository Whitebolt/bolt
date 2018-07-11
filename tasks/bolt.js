'use strict';

const path = require('path');
const fs = require('fs');
const rollupMemoryPlugin = require('../lib/rollupMemoryPlugin');
const gulpBoltBrowser = require('../lib/gulpBoltBrowser');

const cacheId = 'gulpBolt';


function fn(
	gulp, rollupVinylAdaptor, sourcemaps, ignore, uglifyEs, rename, rollupBabel, rollupNodeResolve,
	rollupPluginCommonjs, settings, done, rollup, rollupPluginJson
) {
	const webPath = 'lib';
	const waiting = {current:2};
	const config = {...settings, ...(require(path.join(settings.cwd, 'package.json')).config || {})};
	const dest = path.join(config.boltRootDir, 'private', config.name, webPath);
	const cacheDir = path.join(config.boltRootDir, 'cache', config.name);

	rollupVinylAdaptor({
		rollup,
		input: {
			input: path.join(cacheDir, `${config.outputName}.js`),
			external: ['text-encoding'],
			//cache: bolt.getRollupBundleCache({cacheDir, id:cacheId}),
			plugins: [
				rollupNodeResolve(bolt.get(config, 'browserExport.nodeResolve', {})),
				rollupPluginCommonjs({}),
				rollupPluginJson(),
				rollupBabel({
					exclude: 'node_modules/**',
					generatorOpts: bolt.get(config, 'browserExport.babel.generatorOpts', {}),
					presets: bolt.get(config, 'browserExport.babel.presets', []),
					externalHelpers: true,
					sourceMaps: true,
					plugins: [
						'@babel/plugin-external-helpers',
						...bolt.get(config, 'browserExport.babel.plugins', [])
					]
				})
			]
		},
		output: {
			globals: {'text-encoding':'window'},
			format: 'iife',
			name: config.outputName,
			sourcemap: true
		}
	})
		.on('error', err=>{
			console.error(err);
			done();
		})
		.on('bundle', bundle=>bolt.saveRollupBundleCache({bundle, cacheDir, id:cacheId, waiting, done}))
		.pipe(sourcemaps.init({loadMaps: true}))
		.pipe(rename(path=>{path.dirname = '';}))
		.pipe(gulpBoltBrowser())
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