'use strict';

const path = require('path');
const write = require('util').promisify(require('fs').writeFile);

const filesId = '__react';

bolt.ExportToBrowserReactBoltEvent = class ExportToBrowserReactBoltEvent extends bolt.Event {};

function getExportNameFromFileName(target) {
	return bolt.upperCamelCase(path.basename(path.basename(path.basename(target, '.jsx'), '.js'), '.json'));
}


module.exports = function(){
	// @annotation key loadAllComponents
	// @annotation when after
	// @annotation once

	return app=>setImmediate(async ()=>{
		if (!bolt[filesId]) return;
		const name = 'ReactBolt';
		const cacheDir = bolt.getCacheDir(app);
		const outputFilename = path.join(cacheDir, `${name}.js`);
		const files = [...bolt[filesId]];
		let contents = 'import regeneratorRuntime from "@babel/runtime/regenerator";';
		const exportEventType = 'exportReactComponentToBrowser';
		const requireMap = [];

		const transpiled = await Promise.all(bolt.chain(files)
			.map(async (target)=>(
				(bolt.__transpiled.has(target)) ?
					[await Promise.resolve(bolt.__transpiled.get(target)), target]:
					[target, target]
			))
			.value()
		);

		const names = bolt.chain(transpiled)
			.map(([target, orginalTarget])=>{
				const exports = require(target);
				if (bolt.annotation.get(exports, 'browser-export') !== false) {
					if (!!exports.default) {
						const name = exports.default.name || getExportNameFromFileName(orginalTarget);
						contents += `import ${name} from "${target}";\n`;
						bolt.emit(exportEventType, new bolt.ExportToBrowserReactBoltEvent({
							exportEventType,
							target:orginalTarget,
							sync:false,
							name
						}));
						requireMap.push({name, target});
						return name;
					}
				}
			})
			/*.map(([target, orginalTarget])=>{
				const exported = require(target);
				if (bolt.annotation.get(exported, 'browser-export') !== false) {
					if (!!exported.default) {
						const exportName = exported.default.name || getExportNameFromFileName(orginalTarget);
						const name = `react${bolt.randomString(10)}`;
						contents += `import ${name} from "${target}";\n`;
						bolt.emit(exportEventType, new bolt.ExportToBrowserReactBoltEvent({
							exportEventType,
							target: orginalTarget,
							sync: false,
							name: exportName
						}));
						requireMap.push({name:exportName, target});
						return {name, exportName, exported};
					} else {
						const name = `react${bolt.randomString(10)}`;
						contents += `import * as ${name} from "${target}";\n`;
						const exportName = bolt.chain(exported)
							.keys()
							.forEach(exportName=>bolt.emit(exportEventType, new bolt.ExportToBrowserReactBoltEvent({
								exportEventType,
								target: orginalTarget,
								sync: false,
								name: exportName
							})))
							.value();
						requireMap.push({name:exportName, target});
						return {name, exportName, exported};
					}
				}
			})
			.filter(name=>name)
			.map(({name, exportName, exported})=>{
				if (!!exported.default) {
					if (exportName in exported.default) {
						contents += `const ${exportName} = ${name}.default.${exportName};\n`;
					} else {
						contents += `const ${exportName} = ${name}.default;\n`;
					}
					return exportName;
				} else if (Array.isArray(exportName)) {
					exportName.forEach(exportName=>{
						contents += `const ${exportName} = ${name}.${exportName};\n`;
					});
					return exportName;
				}
			})*/
			.filter(name=>name)
			//.flatten()
			.value();

		contents += `export default {${names.join(',')}}`;

		await bolt.makeDirectory(cacheDir);
		await write(outputFilename, contents);

		bolt.emit('reactBoltBrowserCompiled', {app, name, filesId, requireMap});
	});
};