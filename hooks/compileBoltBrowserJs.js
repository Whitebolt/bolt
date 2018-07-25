'use strict';

const path = require('path');

const filesId = '__modules';


bolt.ExportToBrowserBoltEvent = class ExportToBrowserBoltEvent extends bolt.Event {};


module.exports = function(app) {
	// @annotation key loadRootHooks
	// @annotation when after
	// @annotation once


	return app=>setImmediate(async ()=>{
		if (!bolt[filesId]) return;
		let contents = '';
		const name = 'bolt';
		const cacheDir = bolt.getCacheDir(app);
		const outputFilename = path.join(cacheDir, `${name}.js`);
		const files = [...bolt[filesId]];
		const exportedLookup = new Set();
		const exportEventType = 'exportBoltToBrowserGlobal';

		const exported = bolt.chain(files)
			.map(target=>{
				const exports = require(target);
				const browserExport = (bolt.annotation.get(exports, 'zone') || new Set()).has('browser');

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
					contents += `import lodash from "lodash";`;
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
				contents += `import {${exported.exportedNames.sort().join(',')}} from "${exported.target}";\n`;
			})
			.forEach((exports, n)=>{
				if (n === 0) contents += `const bolt = lodash.runInContext();`;
				exports.exportedNames.forEach(exportedName=>{ // @todo Make this less verbose!
					contents += `bolt["${exportedName}"] = ${exportedName};\n`;
				});
			})
			.value();

		contents += `bolt.MODE = new Set();\n`;
		contents += `window.process = window.process || {};\n`;
		contents += `window.process.env = window.process.env = {};\n`;
		if (app.locals.development) {
			contents += `bolt.MODE.add("DEVELOPMENT");`;
			contents += `window.process.env.NODE_ENV = 'development';`;
		} else {
			contents += `window.process.env.NODE_ENV = 'production';`;
		}
		if (app.locals.debug) contents += `bolt.MODE.add("DEBUG");`;
		if (app.locals.production) contents += `bolt.MODE.add("PRODUCTION");`;
		contents += `bolt.LOGLEVEL = ${app.locals.logLevel}\n`;
		contents += `bolt.VERSION = {lodash:bolt.VERSION, bolt:"${app.locals.version}"}\n`;
		contents += `export default bolt;`;

		await bolt.writeFile(outputFilename, contents, {createDirectories:true});

		bolt.emit('boltBrowserCompiled', {app, name, filesId});
	});
};