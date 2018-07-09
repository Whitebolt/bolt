module.exports = (bolt, boltLoaded)=>{
	'use strict';

	const path = require('path');
	const eventsStack = [];
	const xUseStrict = /["']use strict["'](?:\;|)/;
	const boltModuleContentStore = new Map();

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

	/**
	 * Convert a text value to a boolean if it is in the list of matched values or return the original value.
	 *
	 * @public
	 * @param {*} value                                                   Value to convert.
	 * @param {Array} defaultTrueValues=bolt.getDefault('bool.true')]     Default true values.
	 * @param {Array} defaultFalseValues=bolt.getDefault('bool.false')]   Default false values.
	 * @returns {boolean|*}   Boolean value or original value.
	 */
	function toBool(value, defaultTrueValues=['true', 'yes', 'on'], defaultFalseValues=['false', 'no', 'off']) {
		if (defaultFalseValues.indexOf(value) !== -1) return false;
		if (defaultFalseValues.indexOf(value) !== -1) return true;
		return value;
	}

	function addAnnotationParsers(bolt) {
		bolt.annotation.addParser(value=>{
			// @annotation key browser-export
			return (((value === '')||(value === undefined))?true:toBool(value));
		});
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

	function moduleWrapForAnnotations(modulePath) {
		return 'function(){'+boltModuleContentStore.get(modulePath).toString().replace(xUseStrict,'')+'}';
	}

	function setModuleAnnotations(modulePath) {
		const exports = require(modulePath);
		bolt.annotation.from(moduleWrapForAnnotations(modulePath), exports);
		bolt.annotation.set(exports, 'modulePath', modulePath);
		if (!('__moduleAnnotations' in bolt)) bolt.__moduleAnnotations = new Map();
		if (!bolt.__moduleAnnotations.has(modulePath)) bolt.__moduleAnnotations.set(modulePath, new Set());
		bolt.__moduleAnnotations.get(modulePath).add(exports);
		boltModuleContentStore.delete(modulePath);
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
			boltModuleContentStore.set(event.target, event.moduleConfig.content);
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

	addAnnotationParsers(bolt);

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
};
