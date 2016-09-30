'use strict';

/**
 * @module bolt/bolt
 */

/**
 * Load hooks in given directory into the application.
 *
 * @private
 * @param {string} roots    Path to search for hook directory in and then load
 *                          hooks from.
 * @returns {Array}         Array of unregister functions for these hooks.
 */
function _loadHooks(roots) {
  return bolt.directoriesInDirectory(roots, ['hooks'])
    .map(dirPath => bolt.require.importDirectory(dirPath, {
      useSyncRequire: true,
      callback: hookPath=>bolt.fire('loadedHook', hookPath)
    }))
    .each(hooks =>
      Object.keys(hooks).forEach(hookName =>
        hooks[hookName].forEach(hook => {
          // priority and context can be added as properties to the function.
          let params = Object.assign(bolt.getDefault('event.defaultOptions'), hook);
          return bolt.hook(hookName, hook, params);
        })
      )
    );
}

/**
 * Load hooks from hooks directories within the application roots.
 * Filename should be the same as the hook name and file should export an array
 * of functions to fire on hook.
 *
 * @public
 * @param {Object} app                      Express application.
 * @param {Array} [roots=app.config.roots]  Root folders to search in.
 * @returns {Promise}                       Promise resolving to supplied
 *                                          express app after loading of hooks
 *                                          and firing of related events.
 */
function loadHooks(app, roots=app.config.root) {
  let fireEvent = 'loadHooks' + (!app.parent?',loadRootHooks':'');
  return bolt.fire(()=>_loadHooks(roots), fireEvent, app).then(() => app);
}

module.exports = {
  loadHooks
};