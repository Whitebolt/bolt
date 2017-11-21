'use strict';

const EventEmitter = require('events');
const Private = require('./Private');
const util = require('util');
const setImmediatePromise = util.promisify(setImmediate);

function splitter(item) {
  return bolt.flattenDeep(bolt.makeArray(item).map(item=>item.split(',')))
    .map(item=>item.trim())
    .filter(item=>(item !== ''));
}

class BoltEventEmitter extends EventEmitter {
  constructor(...params) {
    super(...params);

    Private.set(this, 'before', new EventEmitter(...params));
    Private.set(this, 'after', new EventEmitter(...params));
  }

  async emit(eventName, ...params) {
    await Promise.all(bolt.flattenDeep(splitter(eventName).map(eventName=>
      this.listeners(eventName).map(listener=>
        setImmediatePromise().then(()=>Promise.resolve(listener(...params)))
      )
    )));
  }

  async emitBefore(eventName, ...params) {
    await Promise.all(bolt.flattenDeep(splitter(eventName).map(eventName=>
      Private.get(this, 'before').listeners(eventName).map(listener=>
        setImmediatePromise().then(()=>Promise.resolve(listener(...params)))
      )
    )));
  }

  async emitAfter(eventName, ...params) {
    await Promise.all(bolt.flattenDeep(splitter(eventName).map(eventName=>
      Private.get(this, 'after').listeners(eventName).map(listener=>
        setImmediatePromise().then(()=>Promise.resolve(listener(...params)))
      )
    )));
  }

  emitSync(eventName, ...params) {
    const eventNames = bolt.flattenDeep(splitter(eventName));
    let called = false;

    eventNames.forEach(eventName=>{
      called = called || Private.get(this, 'before').emit(eventName, ...params);
    });
    eventNames.forEach(eventName=>{
      called = called ||  super.emit(eventName, ...params);
    });
    eventNames.forEach(eventName=>{
      called = called || Private.get(this, 'after').emit(eventName, ...params);
    });

    return called;
  }

  async emitThrough(func, eventName, ...params) {
    await this.emitBefore(eventName, ...params);
    await Promise.all([
      setImmediatePromise().then(()=>Promise.resolve(func())),
      this.emit(eventName, ...params)]
    );
    await this.emitAfter(eventName, ...params);
  }

  before(eventName, listener) {
    bolt.flattenDeep(splitter(eventName)).forEach(eventName=>Private.get(this, 'before').on(eventName, listener));
    return this;
  }

  beforeOnce(eventName, listener) {
    bolt.flattenDeep(splitter(eventName)).forEach(eventName=>Private.get(this, 'before').once(eventName, listener));
    return this;
  }

  prependBefore(eventName, listener) {
    bolt.flattenDeep(splitter(eventName)).forEach(eventName=>Private.get(this, 'before').prependListener(eventName, listener));
    return this;
  }

  prependOnceBefore(eventName, listener) {
    bolt.flattenDeep(splitter(eventName)).forEach(eventName=>Private.get(this, 'before').prependOnceListener(eventName, listener));
    return this;
  }

  after(eventName, listener) {
    bolt.flattenDeep(splitter(eventName)).forEach(eventName=>Private.get(this, 'after').on(eventName, listener));
    return this;
  }

  afterOnce(eventName, listener) {
    bolt.flattenDeep(splitter(eventName)).forEach(eventName=>Private.get(this, 'after').once(eventName, listener));
    return this;
  }

  prependAfter(eventName, listener) {
    bolt.flattenDeep(splitter(eventName)).forEach(eventName=>Private.get(this, 'after').prependListener(eventName, listener));
    return this;
  }

  prependAfterOnce(eventName, listener) {
    bolt.flattenDeep(splitter(eventName)).forEach(eventName=>Private.get(this, 'after').prependOnceListener(eventName, listener));
    return this;
  }
}


module.exports = BoltEventEmitter;