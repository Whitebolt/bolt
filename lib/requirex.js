'use strict';

const {extname} = require('path');
const {readFileSync} = require('fs');
const {isInternalModule, xUseStrict} = require('./consts');
const eventsStack = [];

function boltRequireXLoader(bolt, boltLoaded) {
	const fileCache = new Map();

	function init() {
		bolt.__moduleSizes = new Map();
		bolt.ModuleSetScopeEvent = class ModuleSetScopeEvent extends bolt.Event {};
		bolt.ModuleEvaluateEvent = class ModuleEvaluateEvent extends bolt.Event {};
		bolt.ModuleLoadEvent = class ModuleLoadEvent extends bolt.Event {};
		bolt.ModuleLoadedEvent = class ModuleLoadedEvent extends bolt.Event {};

		bolt.forOwn(requireXHandlers, (handler, eventName)=>bolt.require.on(eventName, handler));
	}

	function getExt(filename) {
		return extname(filename).substring(1);
	}

	function getEmitFunction(event) {
		return !!event.sync?bolt.emitSync:bolt.emit;
	}

	function sizeBytesKMbGb(size) {
		if (size < 1024) return `${size.toFixed(2)}bytes`;
		if (size < (1024 * 1024)) return `${(size/1024).toFixed(2)}k`;
		if (size < (1024 * 1024 * 1024)) return `${((size/1024)/1024).toFixed(2)}Mb`;
		return `${(((size/1024)/1024)/1024).toFixed(2)}Gb`;
	}

	function getBoltEventName(eventName, ext) {
		return bolt.camelCase(`${eventName}_${ext}`);
	}

	function runAsyncSeries(series, ...params) {
		function next(item) {
			return Promise.resolve(item(...params)).then(()=>
				((series.length)?next(series.shift()):Promise.resolve())
			);
		}
		if (series.length) return next(series.shift());
	}

	function runEventActions(event, actions={}) {
		const ext = getExt(event.target);
		const series = Object.keys(actions).map(eventName=>
			()=>actions[eventName](getBoltEventName(eventName, ext), event)
		);
		return runSeries(!event.sync, series);
	}

	function runSeries(async, series, ...params) {
		if (async === true) return runAsyncSeries(series, ...params);
		if (!bolt.isBoolean(async)) {
			params.unshift(series);
			series = async;
		}

		series.forEach(item=>item(...params));
	}

	function getEventData(event, eventName, data) {
		return {...getEventBoltEventProps(event, eventName), ...data};
	}

	function emitEvent(boltEvent, data) {
		return getEmitFunction(data)(data.type, new boltEvent(data));
	}

	function getEventBoltEventProps(event, eventName) {
		return {type:eventName, target:event.target, source:event.source, sync:event.sync};
	}

	function wrapModuleInFunction(data) {
		return `function(){${data.replace(xUseStrict,'')}}`;
	}

	const boltHandlers = {
		load(eventName, event) {
			return emitEvent(
				bolt.ModuleLoadEvent,
				getEventData(event, eventName, {data: event.data})
			);
		},

		loaded(eventName, event) {
			fileCache.set(
				event.target,
				((event.target === event.otherTarget)?event.data:readFileSync(event.target))
			);

			return emitEvent(
				bolt.ModuleLoadedEvent,
				getEventData(event, eventName, {otherTarget:event.otherTarget, data: event.data})
			);
		},

		setScope(eventName, event) {
			return emitEvent(
				bolt.ModuleSetScopeEvent,
				getEventData(event, eventName, {scope: event.moduleConfig.scope})
			);
		},

		evaluate(eventName, event) {
			return emitEvent(
				bolt.ModuleEvaluateEvent,
				getEventData(event, eventName, {
					config: event.moduleConfig,
					parserOptions: event.parserOptions,
					data: event.data,
					scope: event.moduleConfig.scope
				})
			);
		},

		evaluated(event) {
			if (isInternalModule(event.target) && fileCache.has(event.target)) {
				const data = fileCache.get(event.target).toString('utf-8');
				fileCache.delete(event.target);
				bolt.annotation.from(wrapModuleInFunction(data), event.exports);
			}

			const moduleLoadTime = (((event.duration[0] * 1000000000) + event.duration[1]) / 1000000);
			const size = sizeBytesKMbGb(bolt.__moduleSizes.get(event.target) || 0);
			if (moduleLoadTime < 350) return bolt.emit('loadedModule', event.target, moduleLoadTime, size);
			if (moduleLoadTime > 1000) return bolt.emit('verySlowLoadedModule', event.target, moduleLoadTime, size);
			return bolt.emit('slowLoadedModule', event.target, moduleLoadTime, size);
		}
	};


	const requireXHandlers = {
		load(event) {
			if (boltLoaded() && isInternalModule(event.target)) return runEventActions(
				event,
				{moduleLoad:boltHandlers.load}
			);
		},

		loaded(event) {
			bolt.__moduleSizes.set(event.target, event.size);
			if (boltLoaded() && isInternalModule(event.target)) return runEventActions(
				event,
				{moduleLoaded:boltHandlers.loaded}
			);
		},

		evaluate(event) {
			if (boltLoaded() && isInternalModule(event.target)) return runEventActions(event, {
				moduleSetScope: boltHandlers.setScope,
				moduleEvaluate: boltHandlers.evaluate
			});
		},

		evaluated(event) {
			if (!boltLoaded()) return eventsStack.push(event);
			while (eventsStack.length) boltHandlers.evaluated(eventsStack.pop());
			boltHandlers.evaluated(event);
		},

		error(error) {
			console.log(error);
		}
	};

	init();
}

module.exports = {
	boltRequireXLoader
};