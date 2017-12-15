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

bolt.ExportToBrowserReactBoltEvent = class ExportToBrowserReactBoltEvent extends bolt.Event {};

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

module.exports = ()=>{
	// @annotation key loadAllComponents
	// @annotation when after

	function compileReactBolt(contents) {
		const compiled = {};

		return new Promise((resolve, reject)=>{
			rollupStream({
				input: {contents, path:boltRootDir+'/ReactBolt.js'},
				format: 'iife',
				name: 'ReactBolt',
				sourcemap: true,
				plugins: [
					rollupMemoryPlugin(),
					rollupNodeResolve({
						jsnext: true,
						main: true,
						extensions: ['.jsx', '.js', '.json'],
						browser: true
					}),
					rollupCommonJs(),
					(function(){
						return {
							transform: function(code, id){
								if (bolt.__react.has(id)) {
									const exports = require(id);
									if (bolt.annotation.get(exports, 'browser-export') !== false) {
										const name = exports.default.name;
										code += `ReactBolt.${name} = ${name}`;
									}
								}
								return {
									code,
									map: { mappings: '' }
								}
							}
						};
					})(),
					rollupBabel({
						//exclude: 'node_modules/**',
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
							'@babel/transform-react-jsx',
							'syntax-async-functions',
							'syntax-async-generators',
							'transform-async-generator-functions',
							'transform-regenerator',
							'babel-plugin-transform-es2015-spread'
						]
					})
				]
			})
				.pipe(source('ReactBolt.js'))
				.pipe(vinylBuffer())
				.pipe(gulpSourcemaps.init({loadMaps: true}))
				.pipe(through.obj(function (file, encoding, callback) {
					let contents = 'window.ReactBolt = {};';
					// So CSP does not break, it is always browser anyway.
					contents += file.contents.toString().replace(xBreakingInCSPGetGlobal, 'window');
					contents += `//# sourceMappingURL=${path.basename(file.path)}.map`;
					contents += '}();';
					compiled.file = contents;
					compiled.sourceMap = file.sourceMap;
					this.emit('end');
					return callback(null, file);
				})).on('end', ()=>{
				resolve(compiled);
			}).on('error', error=>reject(error));
		});
	}

	return async app=>{
		let reactBoltContent = 'import regeneratorRuntime from "@babel/runtime/regenerator";';
		const exportEventType = 'exportReactComponentToBrowser';
		//return;

		const names = [...bolt.__react].map(target=>{
			const exports = require(target);

			if (bolt.annotation.get(exports, 'browser-export') !== false) {
				const name = exports.default.name;
				reactBoltContent += `import ${name} from "${target}";\n`;
				bolt.emit(exportEventType, new bolt.ExportToBrowserReactBoltEvent({
					exportEventType,
					target,
					sync:false,
					name
				}));
				return name;
			}
		}).filter(name=>name);

		reactBoltContent += `export default {${names.join(',')}}`;

		const compiled = await compileReactBolt(reactBoltContent);
		app.__reactBoltJs = compiled.file;
		app.__reactBoltJsMap = compiled.sourceMap;

		bolt.__react.clear();
		delete bolt.__react;
	};
};