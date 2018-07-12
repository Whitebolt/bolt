'use strict';

module.exports = function() {
	// @annotation key runApp
	// @annotation when after

	return async ()=>bolt.cron({
		name: 'ClearRequireCache',
		when:'*/5 * * * *',
		fn:()=>Promise.all([
			Promise.resolve(require.clearAllCache()),
			bolt.clearStore('require.*')
		]),
		immediateStart:true,
		runNow:true
	});
};