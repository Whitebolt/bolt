'use strict';

const {toBool} = require('./lib/converters');


function acceptFields(value) {
	// @annotation key accepted-fields

	return (((value === '')||(value === undefined))?true:toBool(value));
}


module.exports = acceptFields;