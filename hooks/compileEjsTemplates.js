'use strict';

bolt.CompileEjsEvent = class CompileEjsEvent extends bolt.Event {};

function getEmitFunction(event) {
  return !!event.sync?bolt.emitSync:bolt.emit;
}

function compile(event) {
  event.data.module.exports = bolt.compileTemplate({
    text:event.config.content,
    filename:event.config.filename,
    options:event.parserOptions
  });
  event.data.module.loaded = true;
}

module.exports = function() {
  // @annotation key moduleEvaluateEjs

  return event=>{
    event.data.module = event.data.module || new require.Module(event.config);
    if (Buffer.isBuffer(event.config.content)) event.config.content = event.config.content.toString();
    const compileEjsEvent = getEmitFunction(event)('compileEjs', new bolt.CompileEjsEvent(event.parserOptions));
    return !!event.sync?compile(event):compileEjsEvent.then(()=>compile(event));
  }
};