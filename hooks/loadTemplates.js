'use strict';

module.exports = function() {
	// @annotation key loadAllComponents
	// @annotation when after
	// @annotation once

	return [
		app=>bolt.loadTemplates(app)
	];
};