'use strict';

module.exports = function() {
	// @annotation key loadInjectors
	// @annotation when after
	// @annotation once

	return [
		app=>bolt.loadComponents(app)
	];
};