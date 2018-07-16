'use strict';

const {toBool} = require('./lib/converters');


function start(value) {
	// @annotation key start

	return (((value === '')||(value === undefined))?true:toBool(value));
}


module.exports = start;