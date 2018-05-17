'use strict';

const config = require(`${boltRootDir}/package.json`).config;
const rollupStream = require('rollup-stream');
const source = require('vinyl-source-stream');
const vinylBuffer = require('vinyl-buffer');
const gulpSourcemaps = require('gulp-sourcemaps');
const gulpBoltBrowser = bolt.requireLib('gulpBoltBrowser');
const rollupNodeResolve = require('rollup-plugin-node-resolve');
const rollupCommonJs = require('rollup-plugin-commonjs');
const rollupBabel = require('rollup-plugin-babel');
const rollupMemoryPlugin = bolt.requireLib('rollupMemoryPlugin');
const rollupReactBoltPlugin = bolt.requireLib('rollupReactBoltPlugin');
const rollupPluginJson = require('rollup-plugin-json');
const append = require('util').promisify(require('fs').appendFile);
const gulpUglifyEs = require.native('gulp-uglify-es').default;
const gulpIgnore = require('gulp-ignore');

function _clearCache(cache) {
	if (cache instanceof Set) cache.clear();
}

function clearCache(name) {
	if (name in bolt) {
		if (bolt[name] instanceof Set) {
			_clearCache(bolt[name]);
		} else if (bolt.isObject(bolt[name])) {
			Object.keys(bolt[name]).forEach(prop=>_clearCache(bolt[name][prop]));
		}

		delete bolt[name];
	}
}

function setVirtualJsFile(name, compiled) {
	if (compiled.file) bolt.setVirtualFile(`/lib/${name}.js`, compiled.file, 'application/javascript');
	if (compiled.sourceMap) bolt.setVirtualFile(`/lib/${name}.js.map`, compiled.sourceMap, 'application/json');
	if (compiled.minFile) bolt.setVirtualFile(`/lib/${name}.min.js`, compiled.minFile, 'application/javascript');
	if (compiled.minSourceMap) bolt.setVirtualFile(`/lib/${name}.min.js.map`, compiled.minSourceMap, 'application/json');
}

function compile(name, options) {
	const compiled = {};

	const boltStream = rollupStream(options)
		.pipe(source(`${name}.js`))
		.pipe(vinylBuffer())
		.pipe(gulpSourcemaps.init({loadMaps: true}))
		.pipe(gulpBoltBrowser({top:`window.${name} = {DEBUG:true};`}))
		.pipe(bolt.extractVinyl(function(file) {
			compiled.file = file.contents.toString();
			if (file.sourceMap) compiled.sourceMap = file.sourceMap;
		}))
		.pipe(gulpIgnore.exclude('*.map'))
		.pipe(gulpUglifyEs({}))
		.pipe(bolt.extractVinyl(function(file) {
			compiled.minFile = file.contents.toString();
			if (file.sourceMap) compiled.minSourceMap = file.minSourceMap;
			this.emit('end');
		}));

	return bolt.streamToPromise(boltStream, compiled);
}

function compileBolt(contents, exported, name) {
	const _rollupNodeResolve = rollupNodeResolve(config.browserExport.nodeResolve);

	const _rollupBabel = rollupBabel({
		exclude: 'node_modules/**',
		generatorOpts: config.browserExport.babel.generatorOpts,
		runtimeHelpers: true,
		presets: config.browserExport.babel.presets,
		plugins: config.browserExport.babel.plugins
	});

	return compile(name, {
		input: {contents, path:`${boltRootDir}/{name}.js`},
		external: ['text-encoding'],
		globals: {'text-encoding':'window'},
		format: 'iife',
		name,
		sourcemap: true,
		plugins: [rollupMemoryPlugin(), _rollupNodeResolve, rollupCommonJs({}), _rollupBabel]
	});
}

function compileReact(contents, name) {
	const _rollupNodeResolve = Object.assign(
		{},
		rollupNodeResolve(config.browserExport.nodeResolve),
		{extensions: ['.jsx'].concat(config.browserExport.nodeResolve).extensions}
	);

	const _rollupBabel = rollupBabel({
		generatorOpts: config.browserExport.babel.generatorOpts,
		runtimeHelpers: true,
		presets: config.browserExport.babel.presets,
		plugins: [
			'@babel/transform-react-jsx',
			...config.browserExport.babel.plugins,
			'transform-decorators-legacy',
			'transform-class-properties'
		]
	});

	return compile(name, {
		input: {contents, path:`${boltRootDir}/${name}.js`},
		format: 'iife',
		name,
		sourcemap: true,
		plugins: [
			rollupMemoryPlugin(),
			_rollupNodeResolve,
			rollupCommonJs(),
			rollupPluginJson(),
			rollupReactBoltPlugin(),
			_rollupBabel
		]
	});
}

async function logExportSequence(id, files) {
	const logDir = `${boltRootDir}/log`;
	const logFile = `${logDir}/${id}.log`;
	await bolt.makeDirectory(logDir);
	await append(logFile, `\n\n${Date().toLocaleString()}\n`);
	return append(logFile, files.join('/n'));
}

module.exports = {
	compileReact, compileBolt, setVirtualJsFile, clearCache, logExportSequence
};