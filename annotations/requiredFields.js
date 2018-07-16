'use strict';

const {toSet} = require('./lib/converters');


function requiredFields(value) {
	// @annotation key required-fields

	return toSet(value);
}


module.exports = requiredFields;