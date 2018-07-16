'use strict';

const {toSet} = require('./lib/converters');


function zone(value) {
	// @annotation key zone

	return toSet(value);
}


module.exports = zone;