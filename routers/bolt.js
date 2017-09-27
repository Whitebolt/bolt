'use strict';

const Promise = require('bluebird');

/**
 * Handle any errors.
 *
 * @param {Error} error     Error object to handle.
 * @param {Object} config   Route config object.
 */
function handleMethodErrors(error, config) {
  console.error(error);
  config.next();
}

/**
 * Call the next method or run applyAndSend if done.
 *
 * @param {Object} config       Router config object.
 * @returns {Promise}           Promise resolving when data has been sent back to user.
 */
async function callMethod(config) {
  const method = Promise.method(config.methods.shift());
  const {router} = config;
  const {res} = router;

  try {
    await method(router);
  } catch (err) {
    return handleMethodErrors(err, config)
  }

  if (router.redirect) {
    let redirect = res.redirect(router.status || 302, router.redirect);
    return ((redirect && redirect.end)?redirect.end():redirect);
  }

  if (router.done && !res.headersSent) return bolt.boltRouter.applyAndSend(router);
  if (!config.methods.length || !!router.done || !!res.headersSent) return router;

  return callMethod(config);
}

/**
 * The bolt router. This will fire return a router function that fires components, controllers and methods according
 * to the bolt routing rules.
 *
 * @private
 * @param {bolt:application} app    Express application object.
 * @returns {Function}              Express router function.
 */
function _httpRouter(app) {
  return (req, res, next)=>{
    let methods = bolt.boltRouter.getMethods(app, req);
    let router = bolt.boltRouter.createRouterObject(req, res);

    if (methods.length) {
      callMethod({methods, router, next}).then(router=>{
        if (router && router.res) {
          if (!router.res.headersSent) {
            next();
          }
        }
      });
    } else {
      next();
    }
  };
}

/**
 * The bolt router. This will fire return a router function that fires components, controllers and methods according
 * to the bolt routing rules. Routing is mimicked as closely as possible in socket.io so routing can transparent
 * for either ajax or websocket.
 *
 * @public
 * @param {bolt:application} app    Express application object.
 * @returns {Function}              Express router function.
 */
function boltRouter(app) {
  // @annotation priority 0

  return _httpRouter(app);
}

module.exports = boltRouter;
