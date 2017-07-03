'use strict';

const serve = require('serve-static');

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