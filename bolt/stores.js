'use strict';
// @annotation zone server manager

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


const stores = {
	clear,
	statDir: new Map(),
	statFile: new Map(),
	readDirCache: getRequireExtraStore('readDirCache'),
	lStatCache: getRequireExtraStore('lStatCache'),
	statCache: getRequireExtraStore('statCache')
};

module.exports = {stores};