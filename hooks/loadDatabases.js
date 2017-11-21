'use strict';

module.exports = function() {
  // @annotation key loadRootHooks
  // @annotation when after

  return [
    app=>bolt.loadDatabases(app)
  ];
};