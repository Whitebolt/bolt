'use strict';

module.exports = function() {
  // @annotation key afterLoadTemplates

  return [
    (hook, app)=>bolt.runApp(app)
  ];
}