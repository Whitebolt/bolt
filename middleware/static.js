'use strict';

const serve = require('serve-static');

/**
 * Serve static content on all public directories inside root directories.
 *
 * @public
 * @param {BoltApplication} app   The bolt application instance.
 */
function init(app) {
  // @annotation priority 10

  /**
   * @todo check if /public exists first
   */
  app.config.root.forEach(rootDir => {
    app.use(serve(rootDir + 'public/', {}));
  });
};

module.exports = init;
