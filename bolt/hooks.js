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
    .map(dirPath => bolt.require.import(dirPath, {
      useSyncRequire: true,
      onload: hookPath=>bolt.fire('loadedHook', hookPath)
    }))
    .each(hooks =>
      Object.keys(hooks).forEach(_key=>{
        const loader = hooks[_key];
        bolt.annotation.from(loader);
        let key = bolt.annotation.get(loader, 'key');
        if (key) {
          loader().forEach(hook=> {
            bolt.annotation.from(hook);
            let priority = bolt.annotation.get(hook, 'priority') || 10;
            let params = Object.assign({}, bolt.getDefault('event.defaultOptions'), {priority});
            return bolt.hook(key, hook, params);
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
  return bolt.fire(()=>_loadHooks(roots), fireEvent, app).then(() => app);
}

module.exports = {
  loadHooks
};