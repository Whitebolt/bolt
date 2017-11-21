'use strict';

/**
 * @module bolt/bolt
 */

const EventEmitter = require('./events');
const PubSub = require('topic-subscribe');
const events = new EventEmitter();
const pubsub = new PubSub();

const eventsExportMethods = ['on', 'once', 'emit', 'emitSync', 'emitBefore', 'emitAfter', 'before', 'after', 'beforeOnce', 'afterOnce', 'emitThrough'];
const pubsubExportMethods = ['subscribe', 'unsubscribe', 'publish', 'broadcast'];

function reflect(methods, from, to={}) {
  methods.forEach(method=>to[method] = from[method].bind(from));
  return to;
}

const exported = reflect(eventsExportMethods, events);
reflect(pubsubExportMethods, pubsub, exported);

module.exports = exported;
