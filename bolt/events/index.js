'use strict';


const EventEmitter =  require('events');
const $private = require('@simpo/private').getInstance();
const util = require('util');
const setImmediatePromise = util.promisify(setImmediate);


function makeArray(ary) {
	if ((ary === undefined) || (ary === null)) return [];
	if (ary instanceof Set) return [...ary.values()];
	return (Array.isArray(ary) ? ary : [ary]);
}

function splitter(item) {
	return bolt.chain(makeArray(item))
		.map(item=>item.split(','))
		.flattenDeep()
		.map(item=>item.trim())
		.filter(item=>(item !== ''))
		.value();
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

		$private.set(this, 'before', before);
		$private.set(this, 'after', after);
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
			splitter(eventName).map(eventName=>$private.get(this, 'before').listeners(eventName))
		).map(listener=>{
			return ()=>setImmediatePromise().then(()=>Promise.resolve(listener(...params)))
		});
		return mapPromises(listeners, ...params);
	}

	async emitAfter(eventName, ...params) {
		const listeners = bolt.flattenDeep(
			splitter(eventName).map(eventName=>$private.get(this, 'after').listeners(eventName))
		).map(listener=>{
			return ()=>setImmediatePromise().then(()=>Promise.resolve(listener(...params)))
		});
		return mapPromises(listeners, ...params);
	}

	emitSyncBefore(eventName, ...params) {
		const eventNames = bolt.flattenDeep(splitter(eventName));
		let called = false;

		eventNames.forEach(eventName=>{
			called = called || $private.get(this, 'before').emit(eventName, ...params);
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
			called = called || $private.get(this, 'after').emit(eventName, ...params);
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
		bolt.flattenDeep(splitter(eventName)).forEach(eventName=>$private.get(this, 'before').on(eventName, listener));
		return this;
	}

	beforeOnce(eventName, listener) {
		bolt.flattenDeep(splitter(eventName)).forEach(eventName=>$private.get(this, 'before').once(eventName, listener));
		return this;
	}

	prependBefore(eventName, listener) {
		bolt.flattenDeep(splitter(eventName)).forEach(eventName=>$private.get(this, 'before').prependListener(eventName, listener));
		return this;
	}

	prependOnceBefore(eventName, listener) {
		bolt.flattenDeep(splitter(eventName)).forEach(eventName=>$private.get(this, 'before').prependOnceListener(eventName, listener));
		return this;
	}

	after(eventName, listener) {
		bolt.flattenDeep(splitter(eventName)).forEach(eventName=>$private.get(this, 'after').on(eventName, listener));
		return this;
	}

	afterOnce(eventName, listener) {
		bolt.flattenDeep(splitter(eventName)).forEach(eventName=>$private.get(this, 'after').once(eventName, listener));
		return this;
	}

	prependAfter(eventName, listener) {
		bolt.flattenDeep(splitter(eventName)).forEach(eventName=>$private.get(this, 'after').prependListener(eventName, listener));
		return this;
	}

	prependAfterOnce(eventName, listener) {
		bolt.flattenDeep(splitter(eventName)).forEach(eventName=>$private.get(this, 'after').prependOnceListener(eventName, listener));
		return this;
	}
}


module.exports = BoltEventEmitter;