'use strict';

module.exports = function() {
	// @annotation key loadMiddleware
	// @annotation when after
	// @annotation once

	return [
		app=>bolt.loadSchemas(app)
	];
};