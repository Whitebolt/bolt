'use strict';

/**
 * @module bolt/bolt
 */

function _addMethodProperties(routers, routerName) {
  let method = routers[routerName];
  let priority = (method.hasOwnProperty('priority') ? method.priority : 10);
  method.id = routerName;
  method.priority = parseInt(priority, 10);
  method.route = method.route || '/*';
  method.method = method.method || 'all';
  return routers[routerName];
}

function _loadRoutes(app, roots) {
  return bolt
    .importIntoObject({roots, dirName:'routers', eventName:'loadedRouter'})
    .then(routers=>routers[0])
    .then(routers=>Object.keys(routers)
      .map(routerName => _addMethodProperties(routers, routerName))
      .sort(bolt.prioritySorter)
    )
    .each(routerBuilder=>{
      bolt.makeArray(routerBuilder(app)).forEach(router=>{
        app[router.method || routerBuilder.method](router.route || routerBuilder.route, router);
      });
    });
}

function loadRoutes(app) {
  return bolt.fire(()=>_loadRoutes(
    app, app.config.root || [], app.routes
  ), 'loadRoutes', app).then(() => app);
}

module.exports = {
  loadRoutes
};