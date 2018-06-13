const path = require('path');
const fs = require('fs');
const rollupMemoryPlugin = require('../lib/rollupMemoryPlugin');
const gulpBoltBrowser = require('../lib/gulpBoltBrowser');

function fn(
	gulp, rollupStream, vinylSourceStream, vinylBuffer, sourcemaps, ignore, uglifyEs, rename,
	rollupBabel, rollupNodeResolve, rollupPluginCommonjs
) {

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
		plugins: [rollupMemoryPlugin(), _rollupNodeResolve, rollupPluginCommonjs({}), _rollupBabel]
	})
		.pipe(vinylSourceStream(`${settings.outputName}.js`))
		.pipe(vinylBuffer())
		.pipe(sourcemaps.init({loadMaps: true}))
		//top:`window.${settings.outputName} = {DEBUG:true};`
		.pipe(gulpBoltBrowser({}))
		.pipe(sourcemaps.write('./', {sourceMappingURLPrefix:'/lib'}))
		.pipe(gulp.dest(dest))
		.pipe(ignore.exclude('*.map'))
		.pipe(uglifyEs.default({}))
		.pipe(rename(path=>{path.extname = '.min.js';}))
		.pipe(sourcemaps.write('./', {sourceMappingURLPrefix:'/lib'}))
		.pipe(gulp.dest(dest));
}

module.exports = fn;