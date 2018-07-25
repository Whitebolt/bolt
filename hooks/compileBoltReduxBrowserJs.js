'use strict';

const path = require('path');

const reduxType = ['types', 'actionCreators', 'reducers'];
const filesId = '__redux';

bolt.ExportToBrowserReduxBoltEvent = class ExportToBrowserReduxBoltEvent extends bolt.Event {};


module.exports = function(){
	// @annotation key loadAllComponents
	// @annotation when after
	// @annotation once

	function loadReduxExport(type, files) {
		const exportEventType = `exportRedux${bolt.peakCase(type)}ToBrowser`;
		let content = '';

		const items = bolt.chain(files)
			.map(target=>{
				const exports = require(target);

				if (bolt.annotation.get(exports, 'browser-export') !== false) {
					const name = `redux${bolt.randomString(10)}`;

					content += ((type === 'types') ?
						`import ${name} from "${target}";\n` : `import * as ${name} from "${target}";\n`
					);

					Object.keys(exports.default||exports).forEach(name=>bolt.emit(
						exportEventType,
						new bolt.ExportToBrowserReduxBoltEvent({exportEventType, target, sync:false, name})
					));
					if (type === 'types') content += `Object.keys(${name}).forEach(type=>{
						${name}[type] = Symbol(${name}[type]);
						${name}[${name}[type]] = type;
					});`;

					return name;
				}
			})
			.filter(name=>name)
			.value();

		content += `const ${type} = Object.assign({}, ...[${items.join(',')}]);`;
		return content;
	}

	return app=>setImmediate(async ()=>{
		if (!bolt[filesId]) return;
		const name = 'ReduxBolt';
		const cacheDir = bolt.getCacheDir(app);
		const outputFilename = path.join(cacheDir, `${name}.js`);
		let contents = 'import regeneratorRuntime from "@babel/runtime/regenerator";';
		contents += reduxType.map(type=>{
			const files = [...bolt[filesId][type]];
			return loadReduxExport(type, files);
		}).join('\n') + '\n';

		const extras = bolt.chain(bolt.ReduxBolt)
			.keys()
			.filter(prop=>(reduxType.indexOf(prop) === -1))
			.map(prop=>{
				contents += `const ${prop} = ${bolt.ReduxBolt[prop].toString()};`;
				return prop;
			})
			.value();

		contents += `export default {${[...reduxType, ...extras].join(',')}};`;

		await bolt.writeFile(outputFilename, contents, {createDirectories:true});

		bolt.emit('reduxBoltBrowserCompiled', {app, name, filesId});
	});
};