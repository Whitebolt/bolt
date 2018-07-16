'use strict';

const {toBool} = require('./lib/converters');


function browserExport(value) {
	// @annotation key browser-export

	return (((value === '')||(value === undefined))?true:toBool(value));
}


module.exports = browserExport;