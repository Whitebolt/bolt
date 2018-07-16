'use strict';

const path = require('path');
const eventsStack = [];

function boltRequireXLoader(bolt, boltLoaded) {
	bolt.__moduleSizes = new Map();

	function runSeries(async, series, ...params) {
		if (async === true) return _runAsyncSeries(series, ...params);
		if (!bolt.isBoolean(async)) {
			params.unshift(series);
			series = async;
		}

		series.forEach(item=>item(...params));
	}

	function _runAsyncSeries(series, ...params) {
		function next(item) {
			return Promise.resolve(item(...params)).then(()=>
				((series.length)?next(series.shift()):Promise.resolve())
			);
		}
		if (series.length) return next(series.shift());
	}

	function sizeBytesKMbGb(size) {
		if (size < 1024) return `${size.toFixed(2)}bytes`;
		if (size < (1024 * 1024)) return `${(size/1024).toFixed(2)}k`;
		if (size < (1024 * 1024 * 1024)) return `${((size/1024)/1024).toFixed(2)}Mb`;
		return `${(((size/1024)/1024)/1024).toFixed(2)}Gb`;
	}

	function moduleLoaded(event) {
		const moduleLoadTime = (((event.duration[0] * 1000000000) + event.duration[1]) / 1000000);
		const size = sizeBytesKMbGb(bolt.__moduleSizes.get(event.target) || 0);
		if (moduleLoadTime < 350) {
			bolt.emit('loadedModule', event.target, moduleLoadTime, size);
		} else {
			if (moduleLoadTime > 1000) {
				return bolt.emit('verySlowLoadedModule', event.target, moduleLoadTime, size);
			} else {
				return bolt.emit('slowLoadedModule', event.target, moduleLoadTime, size);
			}
		}
	}

	function getEmitFunction(event) {
		return !!event.sync?bolt.emitSync:bolt.emit;
	}

	function load(eventName, event) {
		return getEmitFunction(event)(eventName, new bolt.ModuleLoadEvent({
			type:eventName,
			target:event.target,
			source:event.source,
			sync: event.sync,
			data: event.data
		}));
	}

	function loaded(eventName, event) {
		return getEmitFunction(event)(eventName, new bolt.ModuleLoadedEvent({
			type:eventName,
			target:event.target,
			otherTarget:event.otherTarget,
			source:event.source,
			sync: event.sync,
			data: event.data
		}));
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

	function onLoad(event) {
		if (boltLoaded() && (event.target.indexOf('node_modules/') === -1)) {
			const ext = path.extname(event.target);
			return runSeries(!event.sync, [
				()=>load(bolt.camelCase(`moduleLoad_${ext.substring(1)}`), event)
			]);
		}
	}

	function onLoaded(event) {
		bolt.__moduleSizes.set(event.target, event.size);
		if (boltLoaded() && (event.target.indexOf('node_modules/') === -1)) {
			const ext = path.extname(event.target);
			return runSeries(!event.sync, [
				()=>loaded(bolt.camelCase(`moduleLoaded_${ext.substring(1)}`), event)
			]);
		}
	}

	function onEvaluate(event) {
		if ((event.target.indexOf('node_modules/') === -1)) {
			if (boltLoaded()) {
				const ext = path.extname(event.target);
				event.moduleConfig.scope = event.moduleConfig.scope || {};
				return runSeries(!event.sync, [
					()=>setScope(bolt.camelCase(`moduleSetScope_${ext.substring(1)}`), event),
					()=>evaluate(bolt.camelCase(`moduleEvaluate_${ext.substring(1)}`), event)
				]);
			}
		}
	}

	function onEvaluated(event) {
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
		.on('load', onLoad)
		.on('loaded', onLoaded)
		.on('evaluate', onEvaluate)
		.on('evaluated', onEvaluated)
		.on('error', onError);


	bolt.ModuleSetScopeEvent = class ModuleSetScopeEvent extends bolt.Event {};
	bolt.ModuleEvaluateEvent = class ModuleEvaluateEvent extends bolt.Event {};
	bolt.ModuleLoadEvent = class ModuleLoadEvent extends bolt.Event {};
	bolt.ModuleLoadedEvent = class ModuleLoadedEvent extends bolt.Event {};
}

module.exports = {
	boltRequireXLoader
};