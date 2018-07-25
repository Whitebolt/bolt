'use strict';

const path = require('path');
const fs = require('fs');
const rollupReactBoltPlugin = require('../lib/rollupReactBoltPlugin');

const xBreakingInCSPGetGlobal = /Function\(["']return this["']\)\(\)/g;
const cspReplace = 'window';
const cacheId = 'gulpReact';


function fn(
	gulp, rollupVinylAdaptor, sourcemaps, ignore, uglifyEs, rename, rollupBabel, rollupNodeResolve,
	rollupPluginCommonjs, rollupPluginJson, settings, replaceWithSourcemaps, header, done,
	rollup, rollupPluginSourcemaps, babelResolveTransform
) {
	const webPath = 'lib';
	const waiting = {current:2};
	const config = {...settings, ...(require(path.join(settings.cwd, 'package.json')).config || {})};
	const source = path.join(config.cacheDir, `${config.outputName}.js`);
	const dest = path.join(config.boltRootDir, 'public', 'dynamic', config.name, webPath);

	rollupVinylAdaptor({
		rollup,
		input: {
			input: source,
			// @todo: Cache fails because of commonjs-plugin stuff in cache (I think)
			//cache: bolt.getRollupBundleCache({cacheDir:config.cacheDir, id:cacheId}),
			plugins: [
				rollupNodeResolve({
					...bolt.get(config, 'browserExport.nodeResolve', {}),
					extensions:[
						'.jsx',
						...bolt.get(config, 'browserExport.nodeResolve.extensions', [])
					]
				}),
				rollupPluginCommonjs({}),
				rollupPluginJson(),
				rollupBabel({
					generatorOpts: bolt.get(config, 'browserExport.babel.generatorOpts', {}),
					presets: bolt.get(config, 'browserExport.babel.presets', []),
					externalHelpers: true,
					sourceMaps: true,
					plugins: [
						babelResolveTransform(bolt.pick(config, ['root'])),
						'@babel/plugin-external-helpers',
						...bolt.get(config, 'browserExport.babel.plugins', [])
					]
				}),
				rollupReactBoltPlugin(config),
				rollupPluginSourcemaps()
			]
		},
		output: {
			format: 'iife',
			name: config.outputName,
			sourcemap: true
		}
	})
		.on('bundle', bundle=>bolt.saveRollupBundleCache({bundle, cacheDir:config.cacheDir, id:cacheId, waiting, done}))
		.on('warn', warning=>console.warn(warning))
		.on('error', err=>{
			console.error(err);
			done();
		})
		.pipe(sourcemaps.init({loadMaps: true}))
		.pipe(rename(path=>{path.dirname = '';}))
		.pipe(header(`window.${settings.outputName} = {DEBUG:true};`))
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