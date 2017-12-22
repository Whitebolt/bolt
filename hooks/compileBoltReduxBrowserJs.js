'use strict';

const {compileReact, setVirtualJsFile, clearCache} = bolt.requireLib('build');
const reduxType = ['types', 'actionCreators', 'reducers'];

bolt.ExportToBrowserReduxBoltEvent = class ExportToBrowserReduxBoltEvent extends bolt.Event {};


module.exports = function(){
	// @annotation key loadAllComponents
	// @annotation when after

	function loadReduxExport(type) {
		const exportEventType = `exportRedux${bolt.peakCase(type)}ToBrowser`;
		let reduxBoltContent = '';

		const items = [...bolt.__redux[type]].map(target=>{
			const exports = require(target);

			if (bolt.annotation.get(exports, 'browser-export') !== false) {
				const name = `redux${bolt.randomString(10)}`;

				reduxBoltContent += ((type === 'types') ?
					`import ${name} from "${target}";\n` : `import * as ${name} from "${target}";\n`
				);

				Object.keys(exports.default||exports).forEach(name=>bolt.emit(
					exportEventType,
					new bolt.ExportToBrowserReduxBoltEvent({exportEventType, target, sync:false, name})
				));
				if (type === 'types') reduxBoltContent += `Object.keys(${name}).forEach(type=>{
					${name}[type] = Symbol(${name}[type]);
					${name}[${name}[type]] = type;
				});`;

				return name;
			}
		}).filter(name=>name);

		reduxBoltContent += `const ${type} = Object.assign({}, ...[${items.join(',')}]);`;
		return reduxBoltContent;
	}

	return async app=>{
		const name = 'ReduxBolt';
		let reduxBoltContent = 'import regeneratorRuntime from "@babel/runtime/regenerator";';
		reduxBoltContent += reduxType.map(type=>loadReduxExport(type)).join('\n') + '\n';

		setVirtualJsFile(name, {
			file:bolt.VirtualFile.AWAIT,
			sourceMap:bolt.VirtualFile.AWAIT
		});

		const extras = Object.keys(bolt.ReduxBolt)
			.filter(prop=>(reduxType.indexOf(prop) === -1))
			.map(prop=>{
				reduxBoltContent += `const ${prop} = ${bolt.ReduxBolt[prop].toString()};`;
				return prop;
			});

		reduxBoltContent += `export default {${[...reduxType, ...extras].join(',')}};`;

		const compiled = await compileReact(reduxBoltContent, name);
		setVirtualJsFile(name, compiled);
		clearCache('__redux');
	};
};