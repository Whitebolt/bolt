'use strict';
// @annotation zone server

/**
 * @module bolt/bolt
 */

const {xStartDigitUnderscore} = bolt.consts;

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

  bolt.annotation.setFrom(method, {
    id: middlewareName,
    priority: parseInt(priority, 10)
  });
  bolt.annotation.from(method);

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
async function _loadMiddleware(app, roots, importObj) {
  let middleware = Object.assign({}, ...await bolt.importIntoObject({
    roots, importObj, dirName:'middleware', eventName:'loadedMiddleware'})
  );

  Object.keys(middleware).map(
    middlewareName=>_annotateMiddlewareMethod(middleware, middlewareName)
  ).sort(
    bolt.prioritySorter
  ).forEach(middleware=>{
    bolt.emit('ranMiddleware', bolt.annotation.get(middleware, 'id').replace(xStartDigitUnderscore, ''));
    middleware(app);
  });

  return app;
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
async function loadMiddleware(app, roots=app.config.root, middleware=app.middleware) {
  await bolt.emitThrough(()=>_loadMiddleware(app, roots, middleware), 'loadMiddleware', app);
  return app;
}

module.exports = {
  loadMiddleware
};
