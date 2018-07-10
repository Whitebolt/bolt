'use strict';

const path = require('path');
const babel = require('@babel/core');
const write = require('util').promisify(require('fs').writeFile);

const xPathSep = new RegExp(`\\${path.sep}`, 'g');
const xJs = /\.js$/;

bolt.CompileJsxEvent = class CompilesJsxEvent extends bolt.Event {};

function getEmitFunction(event) {
	return !!event.sync?bolt.emitSync:bolt.emit;
}

function compile(event) {
	event.data.module = require.get(".js")(event.config);
	event.data.module.loaded = true;
	if (event.data.module.exports.default && bolt.isFunction(event.data.module.exports.default)) {
		bolt.ReactBolt[event.data.module.exports.default.name] = event.data.module.exports.default;
	}
}

function saveToCache(fileName, transpiledContent) {
	const cacheDir = path.join(boltRootDir, 'cache', 'jsx');
	const cacheFileName = path.join(cacheDir, fileName);

	setImmediate(async ()=>{
		await bolt.makeDirectory(cacheDir);
		write(cacheFileName, transpiledContent);
	});
}

function transpile(event) {
	if (Buffer.isBuffer(event.config.content)) event.content = event.config.content.toString();

	try {
		const transpiledFileName = (bolt.__transpiled.has(event.target) ?
			bolt.__transpiled.get(event.target) :
			event.target
		);

		if (!xJs.test(transpiledFileName)) {
			event.config.content = babel.transform(event.config.content, {
				plugins: [
					'@babel/transform-react-jsx',
					['@babel/plugin-proposal-decorators', {legacy:true}],
					['@babel/plugin-proposal-class-properties', {loose:true}],
					'@babel/plugin-proposal-object-rest-spread',
					loadLibModule('babelResolveTransform')
				],
				presets: [['@babel/env', {
					targets: {node: 'current'},
					modules: 'commonjs'
				}]],
				filename: event.target
			}).code;

			saveToCache(`cache${event.target.replace(xPathSep, '-')}.js`, event.config.content);
		}
	} catch(error) {
		console.error(error || event.config.content.toString());
	}

	const compileJsxEvent = getEmitFunction(event)('compileJsx', new bolt.CompileJsxEvent(event.config));

	return ((!!event.sync) ? compile(event) : compileJsxEvent.then(()=>compile(event)));
}

module.exports = function() {
	// @annotation key moduleEvaluateJsx

	return event=>transpile(event);
};