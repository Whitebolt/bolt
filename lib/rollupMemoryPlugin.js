'use strict';

const fs = require('fs');

function isPath(path) {
	return typeof path === 'string';
}

function isContents(contents) {
	return typeof contents === 'string' || Buffer.isBuffer(contents);
}

function rollupMemoryPlugin(config = {}) {
	let path = isPath(config.path) ? config.path : null;
	let contents = isContents(config.contents) ? String(config.contents) : null;
	let contentsPath = isPath(config.contentsPath) ? String(config.contentsPath) : null;

	return {
		name: 'rollup-memory-plugin',

		options(options) {
			const { input } = options;
			if (input && typeof input === 'object') {
				if (isPath(input.path)) path = input.path;
				if (isContents(input.contents)) contents = String(input.contents);
				if (isPath(input.contentsPath)) contentsPath = String(input.contentsPath);
			}
			if (!!contentsPath) contents = fs.readFileSync(contentsPath).toString();
			options.input = path;

			return options;
		},

		resolveId(id) {
			if (path === null || contents === null) throw Error(
				`'path' should be a string and 'contents' should be a string or Buffer`
			);
			if (id === path) return path;
			return null;
		},

		load(id) {
			if (id === path) return contents;
			return null;
		}
	};
}

module.exports = rollupMemoryPlugin;