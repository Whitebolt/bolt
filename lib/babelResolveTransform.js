'use strict';

const path = require('path');

function resolver({node:{source}}, {file:{opts:{filename}}}) {
	const resolver = new bolt.require.Resolver({
		basedir: path.dirname(filename),
		extensions: ['.mjs', '.js', '.jsx', '.json'],
		parent: filename
	});

	source.value = resolver.resolveSync(source.value);
}

function transformResolve() {
	return {
		visitor: {
			ImportDeclaration: resolver
		}
	};
}

module.exports = transformResolve;