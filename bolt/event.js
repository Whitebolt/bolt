'use strict';

/**
 * @module bolt/bolt
 */

const EventEmitter = require('./events');
const events = new EventEmitter();

const exported = {
  subscribe:()=>{},
  broadcast:()=>{}
};

[
  'on', 'once', 'emit', 'emitSync', 'emitBefore', 'emitAfter', 'before', 'after',
  'beforeOnce', 'afterOnce', 'emitThrough'
].forEach(method=>{
  exported[method] = events[method].bind(events);
});

module.exports = exported;