'use strict';

const morgan = require('morgan');
const {Writable} = require('stream');

/**
 * Apply logging.
 *
 * @public
 * @param {BoltApplication} app   The bolt application instance.
 */
function init(app) {
  // @annotation priority 50

  const stream = new Writable({
    write(chunk, encoding, callback) {
      bolt.broadcast('/logging/access', chunk.toString());
      callback();
    }
  });
  app.use(morgan('combined', {stream}));
}

module.exports = init;