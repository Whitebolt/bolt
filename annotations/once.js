'use strict';

const {toBool} = require('./lib/converters');


function once(value) {
	// @annotation key once

	return (((value === '')||(value === undefined))?true:toBool(value));
}


module.exports = once;