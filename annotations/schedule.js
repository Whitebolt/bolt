'use strict';


function schedule(value) {
	// @annotation key schedule

	return (((value === '')||(value === undefined))?'* * * * *':value);
}

module.exports = schedule;