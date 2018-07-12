'use strict';

const {clearCache} = loadLibModule('build');
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
		const cacheDir = path.join(boltRootDir, 'cache', app.config.name);
		const outputFilename = path.join(cacheDir, `${name}.js`);
		const files = [...bolt[filesId]];
		let contents = '';
		const exportEventType = 'exportReactComponentToBrowser';
		const requireMap = [];


		const names = bolt.chain(files)
			.map(target=>((bolt.__transpiled.has(target)) ? [bolt.__transpiled.get(target), target]: [target, target]))
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
			.filter(name=>name)
			.value();

		contents += `export default {${names.join(',')}}`;

		await bolt.makeDirectory(cacheDir);
		await write(outputFilename, contents);

		bolt.runGulp('react', app, [
			`--outputName=${name}`,
			`--contents=${contents}`,
			`--boltRootDir=${boltRootDir}`,
			...bolt.objectToArgsArray(requireMap, 'settings.reactBoltMap')
		]);
		clearCache(filesId);
	});
};