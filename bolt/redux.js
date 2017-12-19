'use strict';

function importer(root, type, onload) {
	return require.import(`${root}/${type}/`, {
		extensions:['.jsx'],
		basedir:__dirname,
		parent: __filename,
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

async function _loadRedux(roots, app) {
	const reduxDirs = await bolt.directoriesInDirectory(roots, ['redux']);
	if (reduxDirs.length) {
		await Promise.all(reduxDirs.map(async (reduxDir)=>{
			await importer(reduxDir, 'types');
			await importer(reduxDir, 'actionCreators');
			await importer(reduxDir, 'reducers');
		}));
	}
}

function loadRedux(app, roots=app.config.root) {
	let fireEvent = 'loadRedux' + (!app.parent?',loadRootRedux':'');
	return bolt.emitThrough(()=>_loadRedux(roots, app), fireEvent, app).then(() => app);
}

module.exports = {
	loadRedux
};