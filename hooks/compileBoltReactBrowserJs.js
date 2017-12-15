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


bolt.ExportToBrowserReactBoltEvent = class ExportToBrowserReactBoltEvent extends bolt.Event {};




module.exports = function(){
	// @annotation key loadAllComponents
	// @annotation when after

	function compileReactBolt(contents) {
		const compiled = {};

		const _rollupNodeResolve = Object.assign(
			{},
			rollupNodeResolve(config.browserExport.nodeResolve),
			{extensions: ['.jsx'].concat(config.browserExport.nodeResolve).extensions}
		);

		const _rollupBabel = rollupBabel({
			generatorOpts: config.browserExport.babel.generatorOpts,
			runtimeHelpers: true,
			presets: config.browserExport.babel.presets,
			plugins: ['@babel/transform-react-jsx'].concat(config.browserExport.babel.plugins)
		});

		const reactBoltStream = rollupStream({
			input: {contents, path:boltRootDir+'/ReactBolt.js'},
			format: 'iife',
			name: 'ReactBolt',
			sourcemap: true,
			plugins: [rollupMemoryPlugin(), _rollupNodeResolve, rollupCommonJs(), rollupReactBoltPlugin(), _rollupBabel]
		})
			.pipe(source('ReactBolt.js'))
			.pipe(vinylBuffer())
			.pipe(gulpSourcemaps.init({loadMaps: true}))
			.pipe(gulpBoltBrowser({top:'window.ReactBolt = {};'}))
			.pipe(bolt.extractVinyl(function(file) {
				compiled.file = file.contents.toString();
				compiled.sourceMap = file.sourceMap;
				this.emit('end');
			}));

		return bolt.streamToPromise(reactBoltStream, compiled);
	}

	return async app=>{
		let reactBoltContent = 'import regeneratorRuntime from "@babel/runtime/regenerator";';
		const exportEventType = 'exportReactComponentToBrowser';

		const names = [...bolt.__react].map(target=>{
			const exports = require(target);

			if (bolt.annotation.get(exports, 'browser-export') !== false) {
				const name = exports.default.name;
				reactBoltContent += `import ${name} from "${target}";\n`;
				bolt.emit(
					exportEventType,
					new bolt.ExportToBrowserReactBoltEvent({exportEventType, target, sync:false, name})
				);
				return name;
			}
		}).filter(name=>name);

		reactBoltContent += `export default {${names.join(',')}}`;

		const compiled = await compileReactBolt(reactBoltContent);
		bolt.setVirtualFile('/lib/ReactBolt.js', compiled.file, 'application/javascript');
		bolt.setVirtualFile('/lib/ReactBolt.js.map', compiled.sourceMap, 'application/json');

		bolt.__react.clear();
		delete bolt.__react;
	};
};