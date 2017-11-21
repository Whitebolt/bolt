'use strict';

module.exports = function() {
  // @annotation key loadTemplates
  // @annotation when after

  return [
    app=>bolt.runApp(app)
  ];
};