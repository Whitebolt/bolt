'use strict';

module.exports = function() {
  // @annotation key loadAllComponentsDone

  return [
    app=>bolt.runApp(app)
  ];
};