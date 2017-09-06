'use strict';

module.exports = function() {
  // @annotation key afterLoadRoutes

  return [
    (hook, app)=>bolt.fire(()=>bolt.loadShortcodes(app), 'loadShortcodes', app).then(() => app)
  ];
};