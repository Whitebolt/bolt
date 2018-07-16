'use strict';

const {toSet} = require('./lib/converters');


function acceptsConnect(value) {
	// @annotation key accepts-connect

	return toSet(value);
}


module.exports = acceptsConnect;