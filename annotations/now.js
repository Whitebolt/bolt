'use strict';

const {toBool} = require('./lib/converters');


function now(value) {
	// @annotation key now

	return (((value === '')||(value === undefined))?true:toBool(value));
}


module.exports = now;