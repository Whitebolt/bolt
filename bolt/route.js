'use strict';

/**
 * @module bolt/bolt
 */

/**
 * Add bolt properties to router.
 *
 * @private
 * @param {Array.<Function>} routers  Array of router functions.
 * @param {string} routerName         Router name to decorate.
 * @returns {Function}                Decorated router.
 */
function _decorateRouterMethod(routers, routerName) {
  let method = routers[routerName];
  let priority = (method.hasOwnProperty('priority') ? method.priority : 10);
  method.id = routerName;
  method.priority = parseInt(priority, 10);
  method.route = method.route || '/*';
  method.method = method.method || 'all';
  return routers[routerName];
}

/**
 * Load all router components for current bolt application.
 *
 * @private
 * @param {Object} app                    Application to load routes for.
 * @param {Array.<string>|string} roots   Root(s) to load routers from.
 * @returns {Promise}
 */
function _loadRoutes(app, roots) {
  return bolt
    .importIntoObject({roots, dirName:'routers', eventName:'loadedRouter'})
    .then(routers=>routers[0])
    .then(routers=>Object.keys(routers)
      .map(routerName => _decorateRouterMethod(routers, routerName))
      .sort(bolt.prioritySorter)
    )
    .each(routerBuilder=>{
      bolt.makeArray(routerBuilder(app)).forEach(router=>{
        app[router.method || routerBuilder.method](router.route || routerBuilder.route, router);
      });
    });
}

/**
 * Load routers for suplied bolt application.
 *
 * @fires beforeLoadRoutes
 * @fires afterLoadRoutes
 *
 * @public
 * @static
 * @param {Object} app           Express application instance.
 * @returns {Promise.<Object>}   The express application object.
 */
function loadRoutes(app) {
  return bolt.fire(()=>_loadRoutes(
    app, app.config.root || [], app.routes
  ), 'loadRoutes', app).then(() => app);
}

module.exports = {
  loadRoutes
};