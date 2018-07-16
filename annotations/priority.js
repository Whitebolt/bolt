'use strict';

const {toInteger} = require('./lib/converters');


function priority(value) {
	// @annotation key priority

	return toInteger(value);
}


module.exports = priority;