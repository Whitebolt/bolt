'use strict';
// @annotation zone server

/**
 * @module bolt/bolt
 */

const allowedWhen = new Set(['on','after','before'])

function _getBoolAnnotation(ref, key, defaultValue=false) {
	const value = bolt.annotation.get(ref, key);
	return (!bolt.annotation.has(ref, key) ? defaultValue : (value === undefined) ? true : bolt.toBool(value));
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
		.map(async (promise)=>bolt.forIn(await promise, (loader, _name)=>{
			bolt.annotation.from(loader);

			const {
				key,
				when='on',
				once=false,
				schedule,
				name=_name,
				immediateStart=true,
				runNow=true
			} = bolt.annotation.toObject(loader);
			const action = _getEmitAction(when, (schedule?true:once));

			if (key && allowedWhen.has(when)) bolt.makeArray(loader()).forEach(hook=>{
				if (!schedule) return bolt[action](key, hook);
				return bolt[action](key, (...params)=>bolt.cron({
					name,
					schedule,
					fn:()=>hook(...params),
					immediateStart,
					runNow
				}));
			});
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
function loadHooks(app, roots=app.locals.root) {
	let fireEvent = 'loadHooks' + (!app.parent?',loadRootHooks':'');
	return bolt.emitThrough(()=>_loadHooks(roots, app), fireEvent, app).then(()=> app);
}

module.exports = {
	loadHooks
};