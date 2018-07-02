const path = require('path');
const fs = require('fs');
const rollupMemoryPlugin = require('../lib/rollupMemoryPlugin');
const gulpBoltBrowser = require('../lib/gulpBoltBrowser');

const xBreakingInCSPGetGlobal = /Function\(["']return this["']\)\(\)/g;
const cspReplace = 'window';
const cacheId = 'gulpBolt';


function fn(
	gulp, rollupStream, vinylSourceStream, vinylBuffer, sourcemaps, ignore, uglifyEs, rename,
	rollupBabel, rollupNodeResolve, rollupPluginCommonjs, settings, replaceWithSourcemaps,
	regexpSourcemaps, done
) {
	const waiting = {current:2};
	const config = require(`${settings.cwd}/package.json`).config;
	const _rollupNodeResolve = rollupNodeResolve(config.browserExport.nodeResolve);
	const _rollupBabel = rollupBabel({
		exclude: 'node_modules/**',
		generatorOpts: config.browserExport.babel.generatorOpts,
		runtimeHelpers: true,
		presets: config.browserExport.babel.presets,
		plugins: config.browserExport.babel.plugins
	});
	const dest = `${settings.boltRootDir}/private/${settings.name}/lib`;
	const cacheDir = `${settings.boltRootDir}/cache/${settings.name}`;

	rollupStream({
		input: {
			contents:settings.contents,
			contentsPath:settings.contentsPath,
			path:`${settings.cwd}/${settings.outputName}.js`
		},
		external: ['text-encoding'],
		globals: {'text-encoding':'window'},
		format: 'iife',
		name: `${settings.outputName}`,
		sourcemap: true,
		cache: bolt.getRollupBundleCache({cacheDir, id:cacheId}),
		plugins: [
			rollupMemoryPlugin(),
			_rollupNodeResolve,
			rollupPluginCommonjs({}),
			_rollupBabel
		]
	})
		.on('bundle', bundle=>bolt.saveRollupBundleCache({bundle, cacheDir, id:cacheId, waiting, done}))
		.pipe(vinylSourceStream(`${settings.outputName}.js`))
		.pipe(vinylBuffer())
		.pipe(sourcemaps.init({loadMaps: true}))
		.pipe(gulpBoltBrowser())
		.pipe(sourcemaps.write('./', {sourceMappingURLPrefix:'/lib'}))
		.pipe(gulp.dest(dest))
		.pipe(ignore.exclude('*.map'))
		.pipe(uglifyEs.default({}))
		.pipe(rename(path=>{path.extname = '.min.js';}))
		.pipe(sourcemaps.write('./', {sourceMappingURLPrefix:'/lib'}))
		.pipe(gulp.dest(dest))
		.on('end', ()=>bolt.waitCurrentEnd({waiting, done}));
}

module.exports = fn;