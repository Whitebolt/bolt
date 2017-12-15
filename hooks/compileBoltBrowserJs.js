'use strict';

const stream = require('stream');
const rollupStream = require('rollup-stream');
const source = require('vinyl-source-stream');
const vinylBuffer = require('vinyl-buffer');
const gulpSourcemaps = require('gulp-sourcemaps');
const through = require('through2');
const path = require('path');
const rollupNodeResolve = require('rollup-plugin-node-resolve');
const rollupCommonJs = require('rollup-plugin-commonjs');
const rollupBabel = require('rollup-plugin-babel');

const xBreakingInCSPGetGlobal = /Function\(["']return this["']\)\(\)/g;

bolt.ExportToBrowserBoltEvent = class ExportToBrowserBoltEvent extends bolt.Event {};

function rollupMemoryPlugin(config = {}) {
	function isPath(path) {
		return typeof path === 'string';
	}

	function isContents(contents) {
		return typeof contents === 'string' || Buffer.isBuffer(contents);
	}


	let path = isPath(config.path) ? config.path : null;
	let contents = isContents(config.contents) ? String(config.contents) : null;

	return {
		options(options) {
			const { input } = options;
			if (input && typeof input === 'object') {
				if (isPath(input.path)) path = input.path;
				if (isContents(input.contents)) contents = String(input.contents);
			}
			options.input = path;
		},

		resolveId(id) {
			if (path === null || contents === null) {
				throw Error('\'path\' should be a string and \'contents\' should be a string of Buffer');
			}
			if (id === path) return path;
		},

		load(id) {
			if (id === path) return contents;
		}
	};
}


module.exports = function() {
	// @annotation key loadAllComponents
	// @annotation when after

	function compileBolt(contents, exported) {
		const compiled = {};
		const namedExports = {};

		exported.forEach(exported=>{
			namedExports[exported.target] = exported.namedExports
		});

		return new Promise((resolve, reject)=>{
			rollupStream({
				input: {contents, path:boltRootDir+'/bolt.js'},
				format: 'iife',
				name: 'bolt',
				sourcemap: true,
				plugins: [
					rollupMemoryPlugin(),
					rollupNodeResolve({
						jsnext: true,
						main: true,
						extensions: ['.js', '.json'],
						browser: true
					}),
					rollupCommonJs({
						namedExports
					}),
					rollupBabel({
						exclude: 'node_modules/**',
						generatorOpts: {
							compact:true,
							quotes:'double',
							sourceMaps:true
						},
						runtimeHelpers: true,
						presets: [['@babel/env', {
							modules: false,
							targets: {chrome:30},
							useBuiltIns: false,
							forceAllTransforms:true
						}]],
						plugins: [
							'@babel/transform-runtime',
							'syntax-async-functions',
							'syntax-async-generators',
							'transform-async-generator-functions',
							'transform-regenerator',
							'babel-plugin-transform-es2015-spread'
						]
					})
				]
			})
				.pipe(source('bolt.js'))
				.pipe(vinylBuffer())
				.pipe(gulpSourcemaps.init({loadMaps: true}))
				.pipe(through.obj(function (file, encoding, callback) {
					// So CSP does not break, it is always browser anyway.
					let contents = file.contents.toString().replace(xBreakingInCSPGetGlobal, 'window');
					contents += `//# sourceMappingURL=${path.basename(file.path)}.map`;
					compiled.file = contents;
					compiled.sourceMap = file.sourceMap;
					this.emit('end');
					return callback(null, file);
				})).on('end', ()=>{
				resolve(compiled);
			}).on('error', error=>reject(error));
		});
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