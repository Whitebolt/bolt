'use strict';

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
	statFile: new Map()
};

module.exports = {stores};