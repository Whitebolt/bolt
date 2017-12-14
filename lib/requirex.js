module.exports = (bolt, boltLoaded)=>{
  'use strict';

  const path = require('path');
  const eventsStack = [];

  function moduleLoaded(event) {
    bolt.emit('loadedModule', event.target, (((event.duration[0] * 1000000000) + event.duration[1]) / 1000000));
  }

  function getEmitFunction(event) {
    return !!event.sync?bolt.emitSync:bolt.emit;
  }

  function evaluate(eventName, event) {
    return getEmitFunction(event)(eventName, new bolt.ModuleEvaluateEvent({
      type:eventName,
      target:event.target,
      source:event.source,
      config: event.moduleConfig,
      parserOptions: event.parserOptions,
      data: event.data,
      scope: event.moduleConfig.scope,
      sync: event.sync
    }));
  }

  function setScope(eventName, event) {
    return getEmitFunction(event)(eventName, new bolt.ModuleSetScopeEvent({
      type:eventName,
      target:event.target,
      source:event.source,
      scope: event.moduleConfig.scope,
      sync: event.sync
    }));
  }

  bolt.require.on('evaluate', event=>{
    if (boltLoaded()) {
      const ext = path.extname(event.target);
      if (ext.charAt(0) === '.') {
        event.moduleConfig.scope = event.moduleConfig.scope || {};
        return bolt.runSeries(!event.sync, [
          ()=>setScope(bolt.camelCase(`moduleSetScope_${ext.substring(1)}`), event),
          ()=>evaluate(bolt.camelCase(`moduleEvaluate_${ext.substring(1)}`), event)
        ]);
      }
    }
  }).on('evaluated', event=>{
    if (boltLoaded()) {
      while (eventsStack.length) moduleLoaded(eventsStack.pop());
      moduleLoaded(event);
    } else {
      eventsStack.push(event);
    }
  }).on('error', error=>{
    console.log(error);
  });

  bolt.ready(()=>{
    bolt.ModuleSetScopeEvent = class ModuleSetScopeEvent extends bolt.Event {};
    bolt.ModuleEvaluateEvent = class ModuleEvaluateEvent extends bolt.Event {};
  });
};
