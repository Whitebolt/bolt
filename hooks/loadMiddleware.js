'use strict';

module.exports = function() {
	// @annotation key loadDatabases
	// @annotation when after
	// @annotation once

	return [
		app=>bolt.loadMiddleware(app)
	];
};