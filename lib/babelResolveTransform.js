'use strict';

const path = require('path');
const requireX = require('require-extra');

const xNull = /\x00/;


function resolver(
	{node:{source}},
	{file:{opts:{filename}}},
	{paths, extensions=['.mjs', '.js', '.jsx', '.json']}
) {
	if (!xNull.test(source.value)) {
		const resolver = new requireX.Resolver({
			basedir: path.dirname(filename),
			extensions,
			parent: filename,
			paths
		});
		source.value = resolver.resolveSync(source.value);
	}
}

function getPaths(root) {
	return bolt.chain(bolt.makeArray(root))
		.map(root=>{
			const parts = root.split(path.sep).filter(part=>part);
			return [...parts].map(()=>{
				const lookupPath = path.join(path.sep, parts.join(path.sep), 'node_modules');
				parts.pop();
				return lookupPath;
			});
		})
		.flatten()
		.uniq()
		.value();
}

function transformResolve(config) {
	const paths = getPaths(config.root);
	return {
		visitor: {
			ImportDeclaration: (path, state)=>resolver(path, state, {...config, paths})
		}
	};
}

module.exports = transformResolve;