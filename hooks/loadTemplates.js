'use strict';

module.exports = function() {
  // @annotation key loadAllComponents
  // @annotation when after

  return [
    app=>bolt.loadTemplates(app)
  ];
};