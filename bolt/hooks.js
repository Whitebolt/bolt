'use strict';

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
        let key = bolt.annotation.get(loader, 'key');
        let when = bolt.annotation.get(loader, 'when') || 'on';
        if (key && ((when === 'after') || (when === 'before') || (when === 'on'))) {
          loader().forEach(hook=>{
            console.log(key, when);
            bolt.annotation.from(hook);
            return bolt[when](key, hook);
          })
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
  return bolt.emitThrough(()=>_loadHooks(roots, app), fireEvent, app).then(() => app);
}

module.exports = {
  loadHooks
};