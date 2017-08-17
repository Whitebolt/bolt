'use strict';

/**
 * @module bolt/bolt
 */

const xStartDigitUnderscore = /^\d+_/;

/**
 * Add properties to each method used by bolt.
 *
 * @private
 * @param {Function} middleware     The middleware function.
 * @param {string} middlewareName   The middleware name.
 * @returns {Function}              The middleware function with added properties.
 */
function _annotateMiddlewareMethod(middleware, middlewareName) {
  let method = middleware[middlewareName];
  let priority = (method.hasOwnProperty('priority') ? method.priority : 0);

  bolt.annotation(method, {
    id:  middlewareName,
    priority: parseInt(priority, 10)
  });
  bolt.annotation(method);

  return middleware[middlewareName];
}

/**
 * Load all the middleware for the given express app from the middleware directory.  Load in priority order.
 *
 * @private
 * @param {Object} app            The express object.
 * @param {Array|string} roots    The root folders to search for middleware from.
 * @param {Object} importObj      The object to import into.
 * @returns {Promise}             Promise resolved when all middleware loaded.
 */
function _loadMiddleware(app, roots, importObj) {
  return bolt.importIntoObject({
    roots, importObj, dirName:'middleware', eventName:'loadedMiddleware'
  })
    .then(middleware=>middleware[0])
    .then(middleware=>Object.keys(middleware)
        .map(middlewareName => _annotateMiddlewareMethod(middleware, middlewareName))
        .sort(bolt.prioritySorter)
    )
    .then(middleware=>{
      middleware.forEach(middleware => {
        bolt.fire('ranMiddleware', bolt.annotation(middleware, 'id').replace(xStartDigitUnderscore, ''));
        middleware(app);
      });
      return app
    });
}


/**
 * Load all the middleware for the given express app from the middleware directory.  Load in priority order.
 *
 * @public
 * @param {Object} app                              The express object.
 * @param {Array|string} [roots=app.config.root]    The root folders to search for middleware from.
 * @param {Object} [importObj==app.middleware]      The object to import into.
 * @returns {Promise}                               Promise resolved when all middleware loaded.
 */
function loadMiddleware(app, roots=app.config.root, middleware=app.middleware) {
  return bolt.fire(()=>_loadMiddleware(app, roots, middleware), 'loadMiddleware', app).then(() => app);
}

module.exports = {
  loadMiddleware
};
