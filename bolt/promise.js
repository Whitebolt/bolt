'use strict';
// @annotation zone browser server gulp

/**
 * @module bolt/bolt
 */

async function mapAsync(ary, iteree) {
	const mapped = [];
	let n = 0;
	while(ary.length) {
		const result = await iteree(ary.shift(), n, ary);
		mapped.push(result);
		n++;
	}
	return mapped;
}

function makePromise(func) {
	return async (...params)=>{
		try {
			return func(...params);
		} catch(err) {
			return Promise.reject(err);
		}
	};
}

module.exports = {
	mapAsync, makePromise
};