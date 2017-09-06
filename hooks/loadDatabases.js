'use strict';

module.exports = function() {
  // @annotation key afterLoadRootHooks

  return [
    (hook, app)=>bolt.loadDatabases(app)
  ];
};