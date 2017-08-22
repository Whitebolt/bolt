'use strict';

module.exports = function() {
  // @annotation key afterLoadMiddleware

  return [
    (hook, app)=>bolt.loadSchemas(app)
  ];
}