'use strict';

module.exports = function() {
	// @annotation key loadRootHooks
	// @annotation when after
	// @annotation once

	return [
		app=>bolt.loadDatabases(app)
	];
};