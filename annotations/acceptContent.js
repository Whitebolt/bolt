'use strict';

const {toSet} = require('./lib/converters');


function acceptContent(value) {
	// @annotation key accept-content

	return toSet(value);
}


module.exports = acceptContent;