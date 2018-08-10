'use strict';

const {toBool} = require('./lib/converters');


function chain(value) {
	// @annotation key chain

	return (((value === '')||(value === undefined))?true:toBool(value));
}


module.exports = chain;