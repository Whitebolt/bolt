'use strict';

module.exports = function() {
  // @annotation key afterLoadAllComponents

  return [
    (hook, app)=>bolt.loadTemplates(app)
  ];
};