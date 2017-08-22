'use strict';

module.exports = function() {
  // @annotation key afterLoadMiddleware

  return [
    (hook, app)=>bolt.loadRoutes(app)
  ];
}