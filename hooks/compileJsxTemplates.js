'use strict';

const babel = require('babel-core');

bolt.CompileJsxEvent = class CompilesJsxEvent extends bolt.Event {};

function getEmitFunction(event) {
  return !!event.sync?bolt.emitSync:bolt.emit;
}

function compile(event) {
  event.data.module = require.get(".js")(event.config);
  event.data.module.loaded = true;
}

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

    const compileJsxEvent = getEmitFunction(event)('compileJsx', new bolt.CompileJsxEvent(event.config));
    return !!event.sync?compile(event):compileJsxEvent.then(()=>compile(event));
  }
};