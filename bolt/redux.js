'use strict';

function importer({root, type, onload, extensions='.jsx', basedir=__dirname, parent=__filename}) {
	const importPaths = bolt.makeArray(root).map(root=>`${root}/${type}/`);
	return require.import(importPaths, {
		extensions,
		basedir,
		parent,
		onload: (filename, exports)=>{
			Object.keys(exports).forEach(exportName=>{
				if (exportName === 'default') return undefined;
				bolt.ReduxBolt[type][exportName] = exports[exportName];
			});

			bolt.__redux = bolt.__redux || {};
			if (!(type in bolt)) bolt.__redux[type] = new Set();
			bolt.__redux[type].add(filename);
			if (onload) onload(filename, exports);
		}
	});
}

async function _loadRedux(root, app) {
	await importer({root, type:'types', extensions:'.json', onload:(filename, types)=>{
		Object.keys(types).forEach(type=>{
			types[type] = Symbol(types[type]);
			types[types[type]] = type;
		});
	}});
	await importer({root, type:'actionCreators'});
	await importer({root, type:'reducers'});
}

function loadRedux(app, roots=app.config.root) {
	let fireEvent = 'loadRedux' + (!app.parent?',loadRootRedux':'');
	return bolt.emitThrough(()=>_loadRedux(roots, app), fireEvent, app).then(() => app);
}

module.exports = {
	loadRedux
};