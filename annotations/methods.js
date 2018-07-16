'use strict';

const {toSet} = require('./lib/converters');


function methods(value) {
	// @annotation key methods

	return toSet(value, true);
}


module.exports = methods;