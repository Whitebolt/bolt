'use strict';
// @annotation zone server manager gulp

const lockableStores = new WeakSet(); // Don't get caught in infinite loop of wrapping stores.


function getRequireExtraStore(storeId) {
	if ('getStore' in require) return getLockableStore(require.getStore(storeId) || new Map(), storeId);
	return getLockableStore(new Map(), storeId);
}

function getLockableStore(store, storeId) {
	if (lockableStores.has(store) || !bolt.isFunction(store.clear)) return store;

	const locks = new Set();
	const clears = new Set();
	const warnings = new Set();
	const originalClear = store.clear.bind(store);

	store.clear = (...params)=> {
		console.log(locks.size, storeId);
		if (!locks.size) return originalClear(...params);
		if (!!warnings.size) console.warn(`Someone tried to clear store (${storeId}) but is currently locked`);
		let resolve;
		let clear = new Promise(_resolve=>{resolve = _resolve;});
		clears.add(()=>{
			if (!!resolve) resolve(originalClear(...params));
			[resolve, clear] = [undefined, undefined];
		});
		return clear;
	};

	store.lock = (warn=false)=>{
		let warning = Symbol('Warn about lock on store.');
		let lock = ()=>{
			locks.delete(lock);
			warnings.delete(warning);
			[lock, warning] = [undefined, undefined];
			if (!!clears.size) clears.forEach(clear=>clear());
		};
		locks.add(lock);
		if (warn) warnings.add(warning);
		return lock;
	};

	lockableStores.add(store);

	return store;
}

function clearStores(options={}) {
	const {includes=Object.keys(stores),excludes=[]} = options;
	return Promise.all(bolt.difference(bolt.makeArray(includes), ['clear', ...bolt.makeArray(excludes)]).map(storeId=>{
		const store = stores[storeId];
		if ('clear' in store) {
			try {
				return Promise.resolve(store.clear());
			} catch (err) {}
		}
		return Promise.resolve();
	}));
}

function getStore(storeId, constructor=Map, ...constructParams) {
	if (!stores.hasOwnProperty(storeId)) stores[storeId] = new constructor(...constructParams);
	return getLockableStore(stores[storeId], storeId);
}

async function deleteStore(storeId) {
	if (!stores.hasOwnProperty(storeId)) return true;
	await Promise.resolve(stores[storeId].clear());
	delete stores[storeId];
}


const stores = {
	statDir: getRequireExtraStore('statDir'),
	statFile: getRequireExtraStore('statFile'),
	readDirCache: getRequireExtraStore('readDirCache'),
	lStatCache: getRequireExtraStore('lStatCache'),
	statCache: getRequireExtraStore('statCache')
};

module.exports = {stores, getStore, deleteStore, clearStores};