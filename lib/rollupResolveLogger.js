'use strict';

const gulplog = require('gulplog');

const xNull = /\0/g;

function rollupResolveLogger(settings) {
	return {
		resolveId: (id, parent)=>{
			if (xNull.test(id) || !parent) return null;
			if (!!settings.verbose) gulplog.info(`Resolving ${id.replace(xNull, '')}`);
		}
	};
}

module.exports = rollupResolveLogger;