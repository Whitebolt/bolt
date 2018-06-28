module.exports = (bolt, boltLoaded)=>{
	'use strict';

	const path = require('path');
	const eventsStack = [];
	const xUseStrict = /["']use strict["'](?:\;|)/;
	const boltModuleContentStore = new Map();

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

	function moduleLoaded(event) {
		const moduleLoadTime = (((event.duration[0] * 1000000000) + event.duration[1]) / 1000000);
		if (moduleLoadTime < 350) {
			bolt.emit('loadedModule', event.target, moduleLoadTime);
		} else {
			if (moduleLoadTime > 1000) {
				return bolt.emit('verySlowLoadedModule', event.target, moduleLoadTime);
			} else {
				return bolt.emit('slowLoadedModule', event.target, moduleLoadTime);
			}
		}
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
		if (!('__moduleAnnotations' in bolt)) bolt.__moduleAnnotations = new Map();
		if (!bolt.__moduleAnnotations.has(modulePath)) bolt.__moduleAnnotations.set(modulePath, new Set());
		bolt.__moduleAnnotations.get(modulePath).add(exports);
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

	addAnnotationParsers(bolt);

	bolt.require
		.on('evaluate', onEvaluate)
		.on('evaluated', onEvaluated)
		.on('error', onError);

	bolt.ready(()=>{
		bolt.ModuleSetScopeEvent = class ModuleSetScopeEvent extends bolt.Event {};
		bolt.ModuleEvaluateEvent = class ModuleEvaluateEvent extends bolt.Event {};
	});
};
