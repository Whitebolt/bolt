'use strict';


module.exports = function() {
	// @annotation key runApp
	// @annotation when after

	let once = false;
	let clear = ()=>{
		require.clearAllCache();
		bolt.stores.clear();
	};

	return async (app)=>{
		if (!once) {
			once = true;
			setInterval(()=>clear(), 60*1000*2); // every 2 minutes.
			clear();
		}
	}
};