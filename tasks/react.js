const path = require('path');
const fs = require('fs');
const rollupMemoryPlugin = require('../lib/rollupMemoryPlugin');
const gulpBoltBrowser = require('../lib/gulpBoltBrowser');


function fn(
	gulp, rollupStream, vinylSourceStream, vinylBuffer, sourcemaps, ignore, uglifyEs, rename,
	rollupBabel, rollupNodeResolve, rollupPluginCommonjs, rollupPluginJson
) {
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

	rollupStream({
		input: {
			contents:settings.contents,
			path:`${settings.boltRootDir}/${settings.outputName}.js`
		},
		format: 'iife',
		name: `${settings.outputName}.js`,
		sourcemap: true,
		plugins: [
			rollupMemoryPlugin(),
			_rollupNodeResolve,
			rollupPluginCommonjs(),
			rollupPluginJson(),
			_rollupBabel
		]
	})
		.pipe(vinylSourceStream(`${settings.outputName}.js`))
		.pipe(vinylBuffer())
		.pipe(sourcemaps.init({loadMaps: true}))
		.pipe(gulpBoltBrowser({top:`window.${settings.outputName} = {DEBUG:true};`}))
		.pipe(sourcemaps.write('./'))
		.pipe(gulp.dest(`${settings.boltRootDir}/public/lib`))
		.pipe(ignore.exclude('*.map'))
		.pipe(uglifyEs.default({}))
		.pipe(rename(path=>{path.extname = '.min.js';}))
		.pipe(sourcemaps.write('./'))
		.pipe(gulp.dest(`${settings.boltRootDir}/public/lib`));
}

module.exports = fn;