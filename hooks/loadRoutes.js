'use strict';

module.exports = function() {
  // @annotation key loadSchemas
  // @annotation when after

  return [
    app=>bolt.loadRoutes(app)
  ];
};