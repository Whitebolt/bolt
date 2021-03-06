'use strict';

const {websocketMiddleware} = require('@simpo/websocket-express');

/**
 * Create the session object using mongo store. Duplicate session to websocket routes.
 *
 * @public
 * @param {BoltApplication} app   The bolt application instance.
 */
function init(app) {
  // @annotation priority 2

  app.use(websocketMiddleware);
}

module.exports = init;
