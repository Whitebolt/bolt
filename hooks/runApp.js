'use strict';

module.exports = function() {
	// @annotation key loadAllComponentsDone
	// @annotation once

	return [
		app=>bolt.runApp(app)
	];
};