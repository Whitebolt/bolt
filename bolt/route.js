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
function _annotateRouterMethod(routers, routerName) {
  let method = routers[routerName];
  let priority = (method.hasOwnProperty('priority') ? method.priority : 10);

  bolt.annotation(method, {
    id: routerName,
    priority: parseInt(priority, 10),
    route: method.route || '/*',
    method: method.method || 'all'
  });
  bolt.annotationsFromSource(method);

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
      .map(routerName => _annotateRouterMethod(routers, routerName))
      .sort(bolt.prioritySorter)
    )
    .each(routerBuilder=>{
      bolt.makeArray(routerBuilder(app)).forEach(router=>{
        let method = bolt.annotation(router, 'method') || bolt.annotation(routerBuilder, 'method');
        let route = bolt.annotation(router, 'route') || bolt.annotation(routerBuilder, 'route');
        app[method](route, router);
      });
    });
}

/**
 * Load routers for supplied bolt application.
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