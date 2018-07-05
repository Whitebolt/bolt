'use strict';

module.exports = function() {
	// @annotation key runApp
	// @annotation when after

	let interval;
	let clear = ()=>{
		require.clearAllCache();
		bolt.stores.clear();
	};

	return ()=>{
		if (!interval) {
			interval = setInterval(()=>clear(), 60*1000*2); // every 2 minutes.
			clear();
		}
	}
};