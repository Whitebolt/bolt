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
}

module.exports = init;
