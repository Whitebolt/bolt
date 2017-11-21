'use strict';

module.exports = function() {
  // @annotation key loadMiddleware
  // @annotation when after

  return [
    app=>bolt.loadSchemas(app)
  ];
};