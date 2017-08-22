'use strict';

module.exports = function() {
  // @annotation key afterLoadShortcodes

  return [
    (hook, app)=>bolt.loadComponents(app)
  ];
}