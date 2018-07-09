'use strict';

const path = require('path');
const fs = require('fs');
const rollupMemoryPlugin = require('../lib/rollupMemoryPlugin');
const rollupReactBoltPlugin = require('../lib/rollupReactBoltPlugin');

const xBreakingInCSPGetGlobal = /Function\(["']return this["']\)\(\)/g;
const cspReplace = 'window';
const cacheId = 'gulpReact';


function fn(
	gulp, rollupVinylAdaptor, sourcemaps, ignore, uglifyEs, rename, rollupBabel, rollupNodeResolve,
	rollupPluginCommonjs, rollupPluginJson, settings, replaceWithSourcemaps, header, done,
	rollup
) {
	const webPath = 'lib';
	const waiting = {current:2};
	const config = {...settings, ...(require(path.join(settings.cwd, 'package.json')).config || {})};
	const dest = path.join(config.boltRootDir, 'private', config.name, webPath);
	const cacheDir = path.join(config.boltRootDir, 'cache', config.name);

	rollupVinylAdaptor({
		rollup,
		input: {
			input: {
				contents:config.contents,
				contentsPath:config.contentsPath,
				path:path.join(config.cwd, `${config.outputName}.js`)
			},
			//cache: bolt.getRollupBundleCache({cacheDir, id:cacheId}),
			plugins: [
				rollupMemoryPlugin(),
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
						'@babel/plugin-external-helpers',
						'@babel/transform-react-jsx',
						['@babel/plugin-proposal-decorators', {legacy:true}],
						['@babel/plugin-proposal-class-properties', {loose:true}],
						...bolt.get(config, 'browserExport.babel.plugins', [])
					]
				}),
				rollupReactBoltPlugin(config)
			]
		},
		output: {
			format: 'iife',
			name: config.outputName,
			sourcemap: true
		}
	})
		.on('bundle', bundle=>bolt.saveRollupBundleCache({bundle, cacheDir, id:cacheId, waiting, done}))
		.on('error', err=>{
			console.error(err);
			done();
		})
		.pipe(sourcemaps.init({loadMaps: true}))
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