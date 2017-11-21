'use strict';

module.exports = function() {
  // @annotation key loadRoutes
  // @annotation when after

  return [
    app=>bolt.emitThrough(()=>bolt.loadShortcodes(app), 'loadShortcodes', app).then(() => app)
  ];
};