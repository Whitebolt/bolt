'use strict';

const {clearCache} = loadLibModule('build');

const filesId = '__react';

bolt.ExportToBrowserReactBoltEvent = class ExportToBrowserReactBoltEvent extends bolt.Event {};


module.exports = function(){
	// @annotation key loadAllComponents
	// @annotation when after

	return app=>setImmediate(async ()=>{
		if (!bolt[filesId]) return;
		const name = 'ReactBolt';
		const files = [...bolt[filesId]];
		let reactBoltContent = 'import regeneratorRuntime from "@babel/runtime/regenerator";';
		const exportEventType = 'exportReactComponentToBrowser';
		const requireMap = [];

		const names = bolt.chain(files)
			.map(target=>{
				const exports = require(target);

				if (bolt.annotation.get(exports, 'browser-export') !== false) {
					const name = exports.default.name;
					reactBoltContent += `import ${name} from "${target}";\n`;
					bolt.emit(
						exportEventType,
						new bolt.ExportToBrowserReactBoltEvent({exportEventType, target, sync:false, name})
					);
					requireMap.push({name, target});
					return name;
				}
			})
			.filter(name=>name)
			.value();

		reactBoltContent += `export default {${names.join(',')}}`;
		bolt.runGulp('react', app, [
			`--outputName=${name}`,
			`--contents=${reactBoltContent}`,
			`--boltRootDir=${boltRootDir}`,
			...bolt.objectToArgsArray(requireMap, 'settings.reactBoltMap')
		]);
		clearCache(filesId);
	});
};