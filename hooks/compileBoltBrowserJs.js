'use strict';

const config = require(`${boltRootDir}/package.json`).config;
const stream = require('stream');
const rollupStream = require('rollup-stream');
const source = require('vinyl-source-stream');
const vinylBuffer = require('vinyl-buffer');
const gulpSourcemaps = require('gulp-sourcemaps');
const gulpBoltBrowser = bolt.requireLib('gulpBoltBrowser');
const rollupNodeResolve = require('rollup-plugin-node-resolve');
const rollupCommonJs = require('rollup-plugin-commonjs');
const rollupBabel = require('rollup-plugin-babel');
const rollupMemoryPlugin = bolt.requireLib('rollupMemoryPlugin');


bolt.ExportToBrowserBoltEvent = class ExportToBrowserBoltEvent extends bolt.Event {};


module.exports = function() {
	// @annotation key loadAllComponents
	// @annotation when after

	function compileBolt(contents, exported) {
		const compiled = {};
		const namedExports = {};

		exported.forEach(exported=>{
			namedExports[exported.target] = exported.namedExports
		});

		const _rollupNodeResolve = rollupNodeResolve(config.browserExport.nodeResolve);

		const _rollupBabel = rollupBabel({
			exclude: 'node_modules/**',
			generatorOpts: config.browserExport.babel.generatorOpts,
			runtimeHelpers: true,
			presets: config.browserExport.babel.presets,
			plugins: config.browserExport.babel.plugins
		});

		const boltStream = rollupStream({
			input: {contents, path:boltRootDir+'/bolt.js'},
			format: 'iife',
			name: 'bolt',
			sourcemap: true,
			plugins: [rollupMemoryPlugin(), _rollupNodeResolve, rollupCommonJs({namedExports}), _rollupBabel]
		})
			.pipe(source('bolt.js'))
			.pipe(vinylBuffer())
			.pipe(gulpSourcemaps.init({loadMaps: true}))
			.pipe(gulpBoltBrowser({}))
			.pipe(bolt.extractVinyl(function(file) {
				compiled.file = file.contents.toString();
				compiled.sourceMap = file.sourceMap;
				this.emit('end');
			}));

		return bolt.streamToPromise(boltStream, compiled);
	}

	return async (app)=>{
		let boltContent = '';
		const exportedLookup = new Set();
		const exportEventType = 'exportBoltToBrowserGlobal';

		const exported = [boltRootDir + '/lib/lodash', ...bolt.__modules].map(target=>{
			const exports = require(target);
			if (target === boltRootDir + '/lib/lodash') {
				return {
					target,
					exportedNames:Object.keys(exports).filter(name=>bolt.isFunction(exports[name])),
					namedExports:Object.keys(exports)
				};
			}
			if (bolt.annotation.get(exports, 'browser-export')) {
				bolt.emit(exportEventType, new bolt.ExportToBrowserBoltEvent({exportEventType, target, sync: false}));

				return {
					target,
					exportedNames:Object.keys(exports).filter(key=>{
						if (!bolt.isFunction(exports[key])) return true;
						return !((bolt.isFunction(exports[key])) && (bolt.annotation.get(exports[key], 'browser-export') === false));
					}),
					namedExports:Object.keys(exports)
				}
			}
		}).filter(name=>name).reverse().map(exported=>{
			exported.exportedNames = exported.exportedNames.map(name=>{
				if (!exportedLookup.has(name)) {
					exportedLookup.add(name);
					return name;
				}
			}).filter(name=>name);
			return exported;
		}).reverse().map(exported=>{
			boltContent += `import {${exported.exportedNames.sort().join(',')}} from "${exported.target}";\n`;
			return exported;
		});

		bolt.__modules.clear();
		delete bolt.__modules;

		const exportedNames = bolt.flatten(exported.map(exported=>exported.exportedNames)).sort();

		boltContent += `export default {${exportedNames.join(',')}};`;

		const compiled = await compileBolt(boltContent, exported);
		app.__boltJs = compiled.file;
		app.__boltJsMap = compiled.sourceMap;
	}
};