'use strict';

const babel = require('babel-core');

module.exports = function() {
  // @annotation key moduleEvaluateJsx

  return event=>{
    if (Buffer.isBuffer(event.config.content)) event.content = event.config.content.toString();
    event.config.content = babel.transform(event.config.content, {
      plugins: ['transform-react-jsx'],
      presets: [
        ['env', {targets: {node: 'current'}}]
      ]
    }).code;

    event.data.module = require.get(".js")(event.config);
    event.data.module.loaded = true;
  }
};