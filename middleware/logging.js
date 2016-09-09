'use strict';

const morgan = require('morgan');
const Writable = require('stream').Writable;

function init(app) {
  const stream = new Writable({
    write(chunk, encoding, callback) {
      bolt.broadcast('/logging/access', chunk.toString());
      callback();
    }
  });
  app.use(morgan('combined', {stream}));
}

init.priority = 50;
module.exports = init;