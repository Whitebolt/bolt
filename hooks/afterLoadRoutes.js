'use strict';

module.exports = [
  (hook, app)=>bolt.fire(()=>bolt.loadShortcodes(app), 'loadShortcodes', app).then(() => app)
];