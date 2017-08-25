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
function callMethod(config) {
  let method = Promise.method(config.methods.shift());

  return method(config.router).then(router=>{
    if (config.router.done && !config.router.res.headersSent) {
      return bolt.boltRouter.applyAndSend(router);
    } else if (config.methods.length && !config.router.done && !config.router.res.headersSent) {
      return callMethod(config);
    } else {
      return config.router;
    }
  }, error=>handleMethodErrors(error, config));
}

function getErrorReqObject(req, res) {
  const path = '/error/' + res.statusCode;
  return new Proxy(req, {
    get(target, property) {
      if (property === 'path') return path;
      return target[property];
    }
  });
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
  return (_req, res, next)=>{
    if (res.statusCode >= 400) {
      let req = getErrorReqObject(_req, res);
      let methods = bolt.boltRouter.getMethods(app, req, method=>!!bolt.annotation.get(method, 'accept-errors'));
      let router = bolt.boltRouter.createRouterObject(req, res);
      let config = {methods, router, req, res, next};

      router.res.statusMessage = router.res.body;

      if (methods.length) {
        callMethod(config).then(router=>{
          if (router && router.res && !router.res.headersSent) next();
        });
      } else {
        bolt.boltRouter.applyAndSend(router);
        next();
      }
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
function errorRouter(app) {
  // @annotation priority 9999999

  return _httpRouter(app);
}

module.exports = errorRouter;
