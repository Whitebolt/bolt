'use strict';

module.exports = function() {
	// @annotation key runApp
	// @annotation when after

	let once = false;
	const clear = ()=>Promise.all([
		Promise.resolve(require.clearAllCache()),
		bolt.clearStores()
	]);

	return async ()=>{
		if (!once) {
			once = true;
			bolt.cron('2 * * * *', clear, true);
		}
	}
};