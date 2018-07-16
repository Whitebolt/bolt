'use strict';

module.exports = function() {
	// @annotation key runApp
	// @annotation when after
	// @annotation schedule */5 * * * *

	return async ()=>Promise.all([
		Promise.resolve(require.clearAllCache()),
		bolt.clearStore('require.*')
	]);
};