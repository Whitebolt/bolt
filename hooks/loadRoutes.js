'use strict';

module.exports = function() {
  // @annotation key afterLoadSchemas

  return [
    (hook, app)=>bolt.loadRoutes(app)
  ];
};