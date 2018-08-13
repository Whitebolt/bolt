'use strict';

const {toBool} = require('./lib/converters');


function mixin(value) {
	// @annotation key mixin

	return (((value === '')||(value === undefined))?true:toBool(value));
}


module.exports = mixin;