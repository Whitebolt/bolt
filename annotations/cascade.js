'use strict';

const {toBool} = require('./lib/converters');


function cascade(value) {
	// @annotation key cascade

	return (((value === '')||(value === undefined))?true:toBool(value));
}


module.exports = cascade;