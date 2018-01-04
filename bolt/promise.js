'use strict';
// @annotation browser-export

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

module.exports = {
	mapAsync
};