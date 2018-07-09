'use strict';

const {clearCache} = loadLibModule('build');
const reduxType = ['types', 'actionCreators', 'reducers'];
const filesId = '__redux';

bolt.ExportToBrowserReduxBoltEvent = class ExportToBrowserReduxBoltEvent extends bolt.Event {};


module.exports = function(){
	// @annotation key loadAllComponents
	// @annotation when after

	function loadReduxExport(type, files) {
		const exportEventType = `exportRedux${bolt.peakCase(type)}ToBrowser`;
		let reduxBoltContent = '';

		const items = bolt.chain(files)
			.map(target=>{
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
			})
			.filter(name=>name)
			.value();

		reduxBoltContent += `const ${type} = Object.assign({}, ...[${items.join(',')}]);`;
		return reduxBoltContent;
	}

	return app=>setImmediate(async ()=>{
		if (!bolt[filesId]) return;
		const name = 'ReduxBolt';
		let reduxBoltContent = 'import regeneratorRuntime from "@babel/runtime/regenerator";';
		reduxBoltContent += reduxType.map(type=>{
			const files = [...bolt[filesId][type]];
			return loadReduxExport(type, files);
		}).join('\n') + '\n';

		const extras = bolt.chain(bolt.ReduxBolt)
			.keys()
			.filter(prop=>(reduxType.indexOf(prop) === -1))
			.map(prop=>{
				reduxBoltContent += `const ${prop} = ${bolt.ReduxBolt[prop].toString()};`;
				return prop;
			})
			.value();

		reduxBoltContent += `export default {${[...reduxType, ...extras].join(',')}};`;

		bolt.runGulp('redux', app, [
			`--outputName=${name}`,
			`--contents=${reduxBoltContent}`,
			`--boltRootDir=${boltRootDir}`
		]);
		clearCache(filesId);
	});
};