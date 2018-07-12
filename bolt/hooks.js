'use strict';
// @annotation zone server

/**
 * @module bolt/bolt
 */

/**
 * Load hooks in given directory into the application.
 *
 * @private
 * @param {string|array.<string>} roots    Path to search for hook directory in and then load hooks from.
 * @returns {Array.<Function>}             Array of unregister functions for these hooks.
 */
function _loadHooks(roots) {
	return bolt.directoriesInDirectory(roots, ['hooks'])
		.map(dirPath => require.import(dirPath, {
			onload: hookPath=>bolt.emit('loadedHook', hookPath)
		}))
		.each(hooks =>
			Object.keys(hooks).forEach(_key=>{
				const loader = hooks[_key];
				bolt.annotation.from(loader);
				const key = bolt.annotation.get(loader, 'key');
				const when = bolt.annotation.get(loader, 'when') || 'on';
				const _once = bolt.annotation.get(loader, 'once');
				const once = (!bolt.annotation.has(loader, 'once') ?
					false :
					(_once === undefined) ? true : bolt.toBool(_once)
				);

				if (key && ((when === 'after') || (when === 'before') || (when === 'on'))) {
					bolt.makeArray(loader()).forEach(hook=>{
						const action = `${when}${once?'Once':''}`;
						return bolt[action==='onOnce'?'once':action](key, hook);
					});
				}
			})
		);
}

/**
 * Load hooks from hooks directories within the application roots.
 *
 * @public
 * @param {BoltApplication} app                       Express application.
 * @param {Array.<string>} [roots=app.config.roots]   Root folders to search in.
 * @returns {Promise.<BoltApplication>}               Promise resolving to supplied express app after loading of hooks
 *                                                    and firing of related events.
 */
function loadHooks(app, roots=app.config.root) {
	let fireEvent = 'loadHooks' + (!app.parent?',loadRootHooks':'');
	return bolt.emitThrough(()=>_loadHooks(roots, app), fireEvent, app).then(()=> app);
}

module.exports = {
	loadHooks
};