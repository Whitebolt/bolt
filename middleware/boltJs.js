'use strict';

/**
 * Serve browser bolt files
 *
 * @public
 * @param {BoltApplication} app   The bolt application instance.
 */
function init(app) {
  // @annotation priority 7

  app.get('/lib/bolt.js', (req, res, next)=>res.type('.js').status(200).send(req.app.__boltJs));
  app.get('/lib/bolt.js.map', (req, res, next)=>res.type('.js').status(200).send(req.app.__boltJsMap));
  app.get('/lib/bolt.min.js', (req, res, next)=>res.type('.js').status(200).send(req.app.__boltJsMin));
  app.get('/lib/bolt.min.js.map', (req, res, next)=>res.type('.js').status(200).send(req.app.__boltJsMinMap));
}

module.exports = init;
