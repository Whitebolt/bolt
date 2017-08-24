'use strict';

const Promise = require('bluebird');
const httpMethods = require('http').METHODS;

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
    if (config.router.redirect) {
      let redirect = config.res.redirect(config.router.status || 302, config.router.redirect);
      return ((redirect && redirect.end)?redirect.end():redirect);
    } else if (config.router.done && !config.router.res.headersSent) {
      return bolt.boltRouter.applyAndSend(router);
    } else if (config.methods.length && !config.router.done && !config.router.res.headersSent) {
      return callMethod(config);
    } else {
      return config.router;
    }
  }, error=>handleMethodErrors(error, config));
}

/**
 * Function to run when a socket.io message is received matching a http method.
 *
 * @private
 * @param {bolt:application} app            Express application.
 * @param {string} method                   Http method name.
 * @param {Object} socket                   The socket.io object.
 * @param {Object} message                  The socket.io message.
 * @param {Function} [callback]             Socket.io callback method.
 */
function _socketRouterMethod(app, method, socket, message, callback) {
  let {res, req, next} = bolt.createWebsocketRouterObjects(app, message, socket, method, callback);
  let methods = bolt.boltRouter.getMethods(app, req);
  let router = bolt.boltRouter.createRouterObject(req, res, socket);
  let config = {methods, router, req, res, next, callback};

  if (methods.length) callMethod(config);
}


/**
 * Add socket.io routing, which mimics the ordinary ajax style routing as closely as possible.
 *
 * @private
 * @param {bolt:application} app    Express application object.
 * @returns {bolt:application} app  The express application object passed to this function.
 */
function _addSocketIoMethodRouters(app) {
  httpMethods.forEach(method=>bolt.ioOn(method.toLowerCase(), _socketRouterMethod.bind({}, app, method)));
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
    let config = {methods, router, req, res, next};

    if (methods.length) {
      callMethod(config).then(router=>{
        if (router && router.res && !router.res.headersSent) next();
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

  _addSocketIoMethodRouters(app);
  return _httpRouter(app);
}

module.exports = boltRouter;
