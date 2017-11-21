'use strict';

module.exports = function() {
  // @annotation key loadDatabases
  // @annotation when after

  return [
    app=>bolt.loadMiddleware(app)
  ];
};