'use strict';

const EventEmitter = require('events');
const Private = require('./Private');
const util = require('util');
const setImmediatePromise = util.promisify(setImmediate);

function splitter(item) {
	return bolt.chain(bolt.makeArray(item))
		.map(item=>item.split(','))
		.flattenDeep()
		.map(item=>item.trim())
		.filter(item=>(item !== ''))
		.value();
}

// Not used anymore.  We need to fire async events at once then wait, this is better.
function mapPromiseSeries(series, ...params) {
	function next(item) {
		return Promise.resolve(item(...params)).then(()=>
			((series.length)?next(series.shift()):Promise.resolve())
		);
	}
	if (series.length) return next(series.shift());
}

function mapPromises(series, ...params) {
	return Promise.all(series.map(item=>item(...params)));
}

class BoltEventEmitter extends EventEmitter {
	constructor(options={}) {
		super();

		const {maxListeners=120} = options;

		const before = new EventEmitter();
		const after = new EventEmitter();

		super.setMaxListeners(maxListeners);
		before.setMaxListeners(maxListeners);
		after.setMaxListeners(maxListeners);

		Private.set(this, 'before', before);
		Private.set(this, 'after', after);
	}

	async emit(eventName, ...params) {
		const listeners = bolt.flattenDeep(
			splitter(eventName).map(eventName=>this.listeners(eventName))
		).map(listener=>{
			return ()=>setImmediatePromise().then(()=>Promise.resolve(listener(...params)))
		});
		return mapPromises(listeners, ...params);
	}

	async emitBefore(eventName, ...params) {
		const listeners = bolt.flattenDeep(
			splitter(eventName).map(eventName=>Private.get(this, 'before').listeners(eventName))
		).map(listener=>{
			return ()=>setImmediatePromise().then(()=>Promise.resolve(listener(...params)))
		});
		return mapPromises(listeners, ...params);
	}

	async emitAfter(eventName, ...params) {
		const listeners = bolt.flattenDeep(
			splitter(eventName).map(eventName=>Private.get(this, 'after').listeners(eventName))
		).map(listener=>{
			return ()=>setImmediatePromise().then(()=>Promise.resolve(listener(...params)))
		});
		return mapPromises(listeners, ...params);
	}

	emitSyncBefore(eventName, ...params) {
		const eventNames = bolt.flattenDeep(splitter(eventName));
		let called = false;

		eventNames.forEach(eventName=>{
			called = called || Private.get(this, 'before').emit(eventName, ...params);
		});

		return called;
	}

	emitSync(eventName, ...params) {
		const eventNames = bolt.flattenDeep(splitter(eventName));
		let called = false;

		eventNames.forEach(eventName=>{
			called = called ||  super.emit(eventName, ...params);
		});

		return called;
	}

	emitSyncAfter(eventName, ...params) {
		const eventNames = bolt.flattenDeep(splitter(eventName));
		let called = false;

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