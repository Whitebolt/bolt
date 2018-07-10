'use strict';
// @annotation zone server manager

/**
 * @module bolt/bolt
 */

const EventEmitter = require('./events');
const PubSub = require('topic-subscribe');

class Event {
  constructor(config) {
    Object.assign(this, config);
    this.type = config.type || 'Event';
    this.sync = config.sync || true;
  }
}

const events = new EventEmitter();
const pubsub = new PubSub();
const eventsExportMethods = ['on', 'once', 'emit', 'emitSyncBefore', 'emitSync', 'emitSyncAfter', 'emitBefore', 'emitAfter', 'before', 'after', 'beforeOnce', 'afterOnce', 'emitThrough'];
const pubsubExportMethods = ['subscribe', 'unsubscribe', 'publish', 'broadcast'];

function reflect(methods, from, to={}) {
  methods.forEach(method=>to[method] = from[method].bind(from));
  return to;
}

const exported = reflect(eventsExportMethods, events);
reflect(pubsubExportMethods, pubsub, exported);
exported.Event = Event;

exported.waitEmit = (waitEventName, eventName, ...params)=>bolt.afterOnce(
    waitEventName,
    ()=>bolt.emit(eventName, ...params)
);



module.exports = exported;
