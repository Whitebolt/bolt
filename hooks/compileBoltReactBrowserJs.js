'use strict';

const {compileReact, setVirtualJsFile, clearCache, logExportSequence} = bolt.requireLib('build');
const filesId = '__react';

bolt.ExportToBrowserReactBoltEvent = class ExportToBrowserReactBoltEvent extends bolt.Event {};

module.exports = function(){
	// @annotation key loadAllComponents
	// @annotation when after

	return async app=>{
		if (!bolt[filesId]) return;
		const name = 'ReactBolt';
		const files = [...bolt[filesId]];
		if (app.config.development || app.config.debug) await logExportSequence(name, files);
		let reactBoltContent = 'import regeneratorRuntime from "@babel/runtime/regenerator";';
		const exportEventType = 'exportReactComponentToBrowser';

		setVirtualJsFile(name, {
			file:bolt.VirtualFile.AWAIT,
			sourceMap:bolt.VirtualFile.AWAIT
		});

		const names = files.map(target=>{
			const exports = require(target);

			if (bolt.annotation.get(exports, 'browser-export') !== false) {
				const name = exports.default.name;
				reactBoltContent += `import ${name} from "${target}";\n`;
				bolt.emit(
					exportEventType,
					new bolt.ExportToBrowserReactBoltEvent({exportEventType, target, sync:false, name})
				);
				return name;
			}
		}).filter(name=>name);

		reactBoltContent += `export default {${names.join(',')}}`;

		const compiled = await compileReact(reactBoltContent, name);
		setVirtualJsFile(name, compiled);
		clearCache(filesId);
	};
};