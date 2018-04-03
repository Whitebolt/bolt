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

			let browserExport = bolt.annotation.get(exports, 'browser-export');
			if (bolt.__moduleAnnotations.has(target)) {
				bolt.__moduleAnnotations.get(target).forEach(exports=>{
					browserExport = browserExport || bolt.annotation.get(exports, 'browser-export');
				});
				bolt.__moduleAnnotations.get(target).clear();
				bolt.__moduleAnnotations.delete(target);
			}

			if (browserExport) {
				bolt.emit(exportEventType, new bolt.ExportToBrowserBoltEvent({exportEventType, target, sync:false}));
				if (target === boltRootDir + '/lib/lodash') {
					boltContent += `import lodash from "lodash";`;
					return;
				}

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

		boltContent += `const bolt = lodash.runInContext();`;
		exported.forEach(exports=>{
			exports.exportedNames.forEach(exportedName=>{ // @todo Make this less verbose!
				boltContent += `bolt["${exportedName}"] = ${exportedName};\n`;
			});
		});

		boltContent += `bolt.MODE = new Set();\n`;
		if (app.config.debug) boltContent += `bolt.MODE.add("DEBUG");`;
		if (app.config.development) boltContent += `bolt.MODE.add("DEVELOPMENT");`;
		if (app.config.production) boltContent += `bolt.MODE.add("PRODUCTION");`;
		boltContent += `bolt.LOGLEVEL = ${app.config.logLevel}\n`;
		boltContent += `bolt.VERSION = {lodash:bolt.VERSION, bolt:"${app.config.version}"}\n`;
		boltContent += `export default bolt;`;

		const compiled = await compileBolt(boltContent, exported, name);
		setVirtualJsFile(name, compiled);
		clearCache(filesId);
		bolt.__moduleAnnotations.clear();
		delete bolt.__moduleAnnotations;
	}
};