'use strict';
// @annotation browser-export

/**
 * @module bolt/bolt
 */

function classNames(...classes) {
	return bolt.uniq(bolt.flattenDeep(bolt.mapReduce(bolt.flattenDeep(classes), className=>{
		if (bolt.isString(className)) return className.split(' ');
		if (bolt.isObject(className)) return bolt.mapReduce(className, (value, className)=>{
			if (value) return className;
		});
	})).map(className=>className.trim())).join(' ');
}

module.exports = {
	classNames
};