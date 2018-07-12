'use strict';
// @annotation zone server

/**
 * @module bolt/bolt
 */

const allowedWhen = new Set(['on','after','before']);

function _getOnceAnnotation(ref) {
	const _once = bolt.annotation.get(ref, 'once');
	return (!bolt.annotation.has(ref, 'once') ? false : (_once === undefined) ? true : bolt.toBool(_once));
}

function _getEmitAction(when, once) {
	const action = `${when}${once?'Once':''}`;
	return (action==='onOnce'?'once':action);
}

/**
 * Load hooks in given directory into the application.
 *
 * @private
 * @param {string|array.<string>} roots    Path to search for hook directory in and then load hooks from.
 * @returns {Array.<Function>}             Array of unregister functions for these hooks.
 */
async function _loadHooks(roots) {
	const hookDirectories = await bolt.directoriesInDirectory(roots, ['hooks']);

	return Promise.all(bolt.chain(hookDirectories)
		.map(dirPath=>require.import(dirPath, {
			onload: hookPath=>bolt.emit('loadedHook', hookPath)
		}))
		.map(async (promise)=>bolt.forIn(await promise, loader=>{
			bolt.annotation.from(loader);

			const [key, when, once] = [
				bolt.annotation.get(loader, 'key'),
				bolt.annotation.get(loader, 'when') || 'on',
				_getOnceAnnotation(loader)
			];
			const action = _getEmitAction(when, once);

			if (key && allowedWhen.has(when)) bolt.makeArray(loader()).forEach(hook=>bolt[action](key, hook));
		}))
		.value()
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