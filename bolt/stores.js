'use strict';
// @annotation zone server manager gulp

function getRequireExtraStore(storeId) {
	if ('getStore' in require) return require.getStore(storeId) || new Map();
	return new Map();
}

function clear(options={}) {
	const {includes=Object.keys(stores),excludes=[]} = options;
	bolt.difference(bolt.makeArray(includes), ['clear', ...bolt.makeArray(excludes)]).forEach(storeName=>{
		const store = stores[storeName];
		if ('clear' in store) {
			try {
				store.clear();
			} catch (err) {}
		}
	});
}

function getStore(storeId, constructor=Map, ...constructParams) {
	if (!stores.hasOwnProperty(storeId)) stores[storeId] = new constructor(...constructParams);
	return stores[storeId];
}


const stores = {
	clear,
	statDir: getRequireExtraStore('statDir'),
	statFile: getRequireExtraStore('statFile'),
	readDirCache: getRequireExtraStore('readDirCache'),
	lStatCache: getRequireExtraStore('lStatCache'),
	statCache: getRequireExtraStore('statCache')
};

module.exports = {stores, getStore};