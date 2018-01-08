'use strict';

const {compileBolt, setVirtualJsFile, clearCache, logExportSequence} = bolt.requireLib('build');
const filesId = '__modules';

bolt.ExportToBrowserBoltEvent = class ExportToBrowserBoltEvent extends bolt.Event {};


module.exports = function() {
	// @annotation key loadAllComponents
	// @annotation when after

	return async (app)=>{
		if (!bolt[filesId]) return;
		let boltContent = '';
		const name = 'bolt';
		const files = [...bolt[filesId]];
		if (app.config.development || app.config.debug) await logExportSequence(name, files);
		const exportedLookup = new Set();
		const exportEventType = 'exportBoltToBrowserGlobal';

		setVirtualJsFile(name, {
			file:bolt.VirtualFile.AWAIT,
			sourceMap:bolt.VirtualFile.AWAIT
		});

		const exported = files.map(target=>{
			const exports = require(target);
			if (bolt.annotation.get(exports, 'browser-export')) {
				bolt.emit(exportEventType, new bolt.ExportToBrowserBoltEvent({exportEventType, target, sync:false}));
				if (target === boltRootDir + '/lib/lodash') return {
					target,
					exportedNames:Object.keys(exports).filter(name=>bolt.isFunction(exports[name])),
					namedExports:Object.keys(exports)
				};

				return {
					target,
					exportedNames:Object.keys(exports).filter(key=>{
						if (!bolt.isFunction(exports[key])) return true;
						return !((bolt.isFunction(exports[key])) && (bolt.annotation.get(exports[key], 'browser-export') === false));
					}),
					namedExports:Object.keys(exports)
				}
			}
		}).filter(name=>name).reverse().map(exported=>{
			exported.exportedNames = exported.exportedNames.map(name=>{
				if (!exportedLookup.has(name)) {
					exportedLookup.add(name);
					return name;
				}
			}).filter(name=>name);
			return exported;
		}).reverse().map(exported=>{
			boltContent += `import {${exported.exportedNames.sort().join(',')}} from "${exported.target}";\n`;
			return exported;
		});

		const exportedNames = bolt.flatten(exported.map(exported=>exported.exportedNames)).sort();

		boltContent += `export default {${exportedNames.join(',')}};`;

		const compiled = await compileBolt(boltContent, exported, name);
		setVirtualJsFile(name, compiled);
		clearCache(filesId);
	}
};