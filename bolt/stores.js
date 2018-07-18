'use strict';
// @annotation zone server manager gulp

const minimatch = require('minimatch');

const lockableStores = new WeakSet(); // Don't get caught in infinite loop of wrapping stores.
const {xIsRequireId} = bolt.consts;


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

function clearStore(storeId) {
	if (!~storeId.indexOf('*')) {
		if (!stores.hasOwnProperty(storeId)) return true;
		return stores[storeId].clear();
	} else {
		return Promise.all(bolt.chain(stores)
			.keys()
			.filter(id=>minimatch(id, storeId))
			.map(id=>Promise.resolve(stores[id].clear()))
			.value()
		);
	}
}

function getStore(storeId, constructor=Map, ...constructParams) {
	if (!stores.hasOwnProperty(storeId)) stores[storeId] = (xIsRequireId.test(storeId) ?
		getRequireExtraStore(storeId) :
		new constructor(...constructParams)
	);
	return getLockableStore(stores[storeId], storeId);
}

async function deleteStore(storeId) {
	if (!stores.hasOwnProperty(storeId)) return true;
	await Promise.resolve(stores[storeId].clear());
	delete stores[storeId];
}


const stores = {};

module.exports = {stores, getStore, deleteStore, clearStore};