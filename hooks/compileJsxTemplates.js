'use strict';

const babel = require('@babel/core');

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

module.exports = function() {
	// @annotation key moduleEvaluateJsx

	return event=>{
		if (Buffer.isBuffer(event.config.content)) event.content = event.config.content.toString();

		try {
			event.config.content = babel.transform(event.config.content, {
				plugins: [
					'@babel/plugin-syntax-jsx',
					'transform-decorators-legacy',
					'transform-class-properties',
					'@babel/plugin-proposal-object-rest-spread',
					'@babel/transform-react-jsx'
				],
				presets: [['@babel/env', {
					targets: {node: 'current'},
					modules: 'commonjs'
				}]]
			}).code;
		} catch(error) {
			console.error(error || event.config.content.toString());
		}

		const compileJsxEvent = getEmitFunction(event)('compileJsx', new bolt.CompileJsxEvent(event.config));

		return ((!!event.sync) ? compile(event) : compileJsxEvent.then(()=>compile(event)));
	}
};