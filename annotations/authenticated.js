'use strict';

const {toBool} = require('./lib/converters');


function authenticated(value) {
	// @annotation key authenticated

	return (((value === '')||(value === undefined))?true:toBool(value));
}


module.exports = authenticated;