'use strict';

module.exports = function() {
  // @annotation key afterLoadDatabases

  return [
    (hook, app)=>bolt.loadMiddleware(app)
  ];
}