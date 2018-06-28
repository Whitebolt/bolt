const path = require('path');
const fs = require('fs');
const rollupMemoryPlugin = require('../lib/rollupMemoryPlugin');
const gulpBoltBrowser = require('../lib/gulpBoltBrowser');
const rollupReactBoltPlugin = require('../lib/rollupReactBoltPlugin');


function fn(
	gulp, rollupStream, vinylSourceStream, vinylBuffer, sourcemaps, ignore, uglifyEs, rename,
	rollupBabel, rollupNodeResolve, rollupPluginCommonjs, rollupPluginJson, settings
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
			...(config.browserExport.babel.plugins || []),
			'@babel/transform-react-jsx'
		]
	});
	const dest = `${settings.boltRootDir}/private/${settings.name}/lib`;

	return rollupStream({
		input: {
			contents:settings.contents,
			contentsPath:settings.contentsPath,
			path:`${settings.boltRootDir}/${settings.outputName}.js`
		},
		format: 'iife',
		name: `${settings.outputName}`,
		sourcemap: true,
		plugins: [
			rollupMemoryPlugin(),
			_rollupNodeResolve,
			rollupPluginCommonjs(),
			rollupPluginJson(),
			rollupReactBoltPlugin(settings),
			_rollupBabel
		]
	})
		.pipe(vinylSourceStream(`${settings.outputName}.js`))
		.pipe(vinylBuffer())
		.pipe(sourcemaps.init({loadMaps: true}))
		.pipe(gulpBoltBrowser({top:`window.${settings.outputName} = {DEBUG:true};`}))
		.pipe(sourcemaps.write('./', {sourceMappingURLPrefix:'/lib'}))
		.pipe(gulp.dest(dest))
		.pipe(ignore.exclude('*.map'))
		.pipe(uglifyEs.default({}))
		.pipe(rename(path=>{path.extname = '.min.js';}))
		.pipe(sourcemaps.write('./', {sourceMappingURLPrefix:'/lib'}))
		.pipe(gulp.dest(dest));
}

module.exports = fn;