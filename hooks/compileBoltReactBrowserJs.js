'use strict';

const {compileReact, setVirtualJsFile, clearCache} = bolt.requireLib('build');

bolt.ExportToBrowserReactBoltEvent = class ExportToBrowserReactBoltEvent extends bolt.Event {};

module.exports = function(){
	// @annotation key loadAllComponents
	// @annotation when after

	return async app=>{
		const name = 'ReactBolt';
		let reactBoltContent = 'import regeneratorRuntime from "@babel/runtime/regenerator";';
		const exportEventType = 'exportReactComponentToBrowser';

		const names = [...bolt.__react].map(target=>{
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
		clearCache('__react');
	};
};