'use strict';

module.exports = function() {
  // @annotation key loadShortcodes
  // @annotation when after

  return [
    app=>bolt.loadComponents(app)
  ];
};