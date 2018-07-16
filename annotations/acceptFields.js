'use strict';

const {toBool} = require('./lib/converters');


function acceptErrors(value) {
	// @annotation key accepted-errors

	return (((value === '')||(value === undefined))?true:toBool(value));
}


module.exports = acceptErrors;