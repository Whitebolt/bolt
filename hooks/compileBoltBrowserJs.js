'use strict';

const {clearCache} = loadLibModule('build');
const filesId = '__modules';

bolt.ExportToBrowserBoltEvent = class ExportToBrowserBoltEvent extends bolt.Event {};


module.exports = function(app) {
	// @annotation key loadRootHooks
	// @annotation when after


	return app=>setImmediate(async ()=>{
		if (!bolt[filesId]) return;
		let boltContent = '';
		const name = 'bolt';
		const files = [...bolt[filesId]];
		const exportedLookup = new Set();
		const exportEventType = 'exportBoltToBrowserGlobal';

		const exported = bolt.chain(files)
			.map(target=>{
				const exports = require(target);

				let browserExport = (bolt.annotation.get(exports, 'zone') || new Set()).has('browser');
				if (bolt.__moduleAnnotations.has(target)) {
					bolt.__moduleAnnotations.get(target).forEach(exports=>{
						const zones = bolt.annotation.get(exports, 'zone') || new Set();
						browserExport = browserExport || zones.has('browser');
					});
					bolt.__moduleAnnotations.get(target).clear();
					bolt.__moduleAnnotations.delete(target);
				}

				if (browserExport  || (target === 'lodash')) {
					bolt.emit(
						exportEventType,
						new bolt.ExportToBrowserBoltEvent({exportEventType, target, sync:false})
					);
					if (target !== 'lodash') return {
						target,
						exportedNames:Object.keys(exports).filter(key=>{
							if (!bolt.isFunction(exports[key])) return true;
							return !((bolt.isFunction(exports[key])) && (bolt.annotation.get(exports[key], 'browser-export') === false));
						}),
						namedExports:Object.keys(exports)
					};
					boltContent += `import lodash from "lodash";`;
				}
			})
			.filter(name=>name)
			.reverse()
			.forEach(exported=>{
				exported.exportedNames = bolt.chain(exported.exportedNames)
					.map(name=>{
						if (!exportedLookup.has(name)) {
							exportedLookup.add(name);
							return name;
						}
					})
					.filter(name=>name)
					.value();
			})
			.reverse()
			.forEach(exported=>{
				boltContent += `import {${exported.exportedNames.sort().join(',')}} from "${exported.target}";\n`;
			})
			.forEach((exports, n)=>{
				if (n === 0) boltContent += `const bolt = lodash.runInContext();`;
				exports.exportedNames.forEach(exportedName=>{ // @todo Make this less verbose!
					boltContent += `bolt["${exportedName}"] = ${exportedName};\n`;
				});
			})
			.value();

		boltContent += `bolt.MODE = new Set();\n`;
		boltContent += `window.process = window.process || {};\n`;
		boltContent += `window.process.env = window.process.env = {};\n`;
		if (app.config.development) {
			boltContent += `bolt.MODE.add("DEVELOPMENT");`;
			boltContent += `window.process.env.NODE_ENV = 'development';`;
		} else {
			boltContent += `window.process.env.NODE_ENV = 'production';`;
		}
		if (app.config.debug) boltContent += `bolt.MODE.add("DEBUG");`;
		if (app.config.production) boltContent += `bolt.MODE.add("PRODUCTION");`;
		boltContent += `bolt.LOGLEVEL = ${app.config.logLevel}\n`;
		boltContent += `bolt.VERSION = {lodash:bolt.VERSION, bolt:"${app.config.version}"}\n`;
		boltContent += `export default bolt;`;

		bolt.runGulp('bolt', app, [
			`--outputName=${name}`,
			`--contents=${boltContent}`,
			`--boltRootDir=${boltRootDir}`
		]);

		//clearCache(filesId);
		bolt.__moduleAnnotations.clear();
		delete bolt.__moduleAnnotations;
	});
};