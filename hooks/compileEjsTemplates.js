'use strict';

const babel = require('babel-core');

module.exports = function() {
  // @annotation key moduleEvaluateEjs

  return event=>{
    event.data.module = event.data.module || new require.Module(event.config);
    if (Buffer.isBuffer(event.config.content)) event.config.content = event.config.content.toString();
    event.data.module.exports = bolt.compileTemplate({
      text:event.config.content,
      filename:event.config.filename,
      options:event.parserOptions
    });
    event.data.module.loaded = true;
  }
};