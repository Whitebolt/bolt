'use strict';


function when(value) {
	// @annotation key when

	return (((value === '')||(value === undefined))?'on':value);
}


module.exports = when;