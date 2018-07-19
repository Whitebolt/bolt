'use strict';

module.exports = function() {
	// @annotation key loadShortcodes
	// @annotation when after
	// @annotation once

	return [
		app=>bolt.loadInjectors(app)
	];
};