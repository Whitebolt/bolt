'use strict';

const serve = require('serve-static');

function init(app) {
  /**
   * @todo check if /public exists first
   */
  app.config.root.forEach(rootDir => {
    app.use(serve(rootDir + 'public/', {}));
  });
};

init.priority = 10;
module.exports = init;