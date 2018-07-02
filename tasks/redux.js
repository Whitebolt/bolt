const path = require('path');
const fs = require('fs');
const rollupMemoryPlugin = require('../lib/rollupMemoryPlugin');
const cacheId = 'gulpBolt';

const xBreakingInCSPGetGlobal = /Function\(["']return this["']\)\(\)/g;
const cspReplace = 'window';


function fn(
	gulp, rollupStream, vinylSourceStream, vinylBuffer, sourcemaps, ignore, uglifyEs, rename,
	rollupBabel, rollupNodeResolve, rollupPluginCommonjs, rollupPluginJson, settings,
	replaceWithSourcemaps, done
) {
	const waiting = {current:2};
	const config = require(`${settings.boltRootDir}/package.json`).config;
	const _rollupNodeResolve = rollupNodeResolve(Object.assign(
		{},
		config.browserExport.nodeResolve || {},
		{extensions: ['.jsx'].concat(config.browserExport.nodeResolve).extensions}
	));
	const _rollupBabel = rollupBabel({
		generatorOpts: config.browserExport.babel.generatorOpts,
		runtimeHelpers: true,
		presets: config.browserExport.babel.presets,
		plugins: [
			'@babel/plugin-syntax-jsx',
			['@babel/plugin-proposal-decorators', {legacy:true}],
			'transform-class-properties',
			'@babel/plugin-proposal-object-rest-spread',
			'@babel/transform-react-jsx'

		]
	});
	const dest = `${settings.boltRootDir}/private/${settings.name}/lib`;
	const cacheDir = `${settings.boltRootDir}/cache/${settings.name}`;

	rollupStream({
		input: {
			contents:settings.contents,
			contentsPath:settings.contentsPath,
			path:`${settings.boltRootDir}/${settings.outputName}.js`
		},
		format: 'iife',
		name: `${settings.outputName}`,
		cache: bolt.getRollupBundleCache({cacheDir, id:cacheId}),
		sourcemap: true,
		plugins: [
			rollupMemoryPlugin(),
			_rollupNodeResolve,
			rollupPluginCommonjs(),
			rollupPluginJson(),
			_rollupBabel
		]
	})
		.on('bundle', bundle=>bolt.saveRollupBundleCache({bundle, cacheDir, id:cacheId, waiting, done}))
		.pipe(vinylSourceStream(`${settings.outputName}.js`))
		.pipe(vinylBuffer())
		.pipe(sourcemaps.init({loadMaps: true}))
		.pipe(replaceWithSourcemaps(xBreakingInCSPGetGlobal, cspReplace))
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