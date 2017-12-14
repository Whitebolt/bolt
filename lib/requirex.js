module.exports = (bolt, boltLoaded)=>{
  'use strict';

  const path = require('path');
  const eventsStack = [];
  const xUseStrict = /["']use strict["'](?:\;|)/;
  const boltModuleContentStore = new Map();

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

  function moduleWrapForAnnotations(modulePath) {
    return 'function(){'+boltModuleContentStore.get(modulePath).toString().replace(xUseStrict,'')+'}';
  }

  function setModuleAnnotations(modulePath) {
    const exports = require(modulePath);
    bolt.annotation.from(moduleWrapForAnnotations(modulePath), exports);
    bolt.annotation.set(exports, 'modulePath', modulePath);
    boltModuleContentStore.delete(modulePath);
  }

  function onEvaluate(event) {
    if ((event.target.indexOf('node_modules/') === -1)) {
      boltModuleContentStore.set(event.target, event.moduleConfig.content);

      if (boltLoaded()) {
        const ext = path.extname(event.target);
        event.moduleConfig.scope = event.moduleConfig.scope || {};
        return bolt.runSeries(!event.sync, [
          ()=>setScope(bolt.camelCase(`moduleSetScope_${ext.substring(1)}`), event),
          ()=>evaluate(bolt.camelCase(`moduleEvaluate_${ext.substring(1)}`), event)
        ]);
      }
    }
  }

  function onEvaluated(event) {
    if (boltModuleContentStore.has(event.target)) setModuleAnnotations(event.target);

    if (boltLoaded()) {
      while (eventsStack.length) moduleLoaded(eventsStack.pop());
      moduleLoaded(event);
    } else {
      eventsStack.push(event);
    }
  }

  function onError(error) {
    console.log(error);
  }

  bolt.require
    .on('evaluate', onEvaluate)
    .on('evaluated', onEvaluated)
    .on('error', onError);

  bolt.ready(()=>{
    bolt.ModuleSetScopeEvent = class ModuleSetScopeEvent extends bolt.Event {};
    bolt.ModuleEvaluateEvent = class ModuleEvaluateEvent extends bolt.Event {};
  });
};
