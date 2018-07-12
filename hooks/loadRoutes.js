'use strict';

module.exports = function() {
	// @annotation key loadSchemas
	// @annotation when after
	// @annotation once

	return [
		app=>bolt.loadRoutes(app)
	];
};