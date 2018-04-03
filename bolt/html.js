'use strict';
// @annotation browser-export

/**
 * @module bolt/bolt
 */

const xSpaces = /\s+/;

function classNames(...classes) {
	return bolt.uniq(bolt.flattenDeep(bolt.mapReduce(bolt.flattenDeep(classes), className=>{
		if (!className) return;
		if (bolt.isFunction(className)) return classNames(className());
		if (bolt.isString(className)) return className.split(' ');
		if (bolt.isObject(className)) return bolt.mapReduce(className, (value, className)=>{
			if (value) return className;
		});
	})).map(className=>className.trim())).join(' ');
}

function attributes(...attrs) {
	const exportedAttrs = {};
	let displayNext = true;

	bolt.chain(attrs)
		.flatten()
		.forEach(attrs=>{
			if (!displayNext) {
				displayNext = true;
				return;
			}

			if (bolt.isString(attrs)) {
				exportedAttrs[attrs] = true;
			} else if (bolt.isFunction(attrs)) {
				Object.assign(exportedAttrs, attributes(attrs(exportedAttrs)));
			} else if (bolt.isObject(attrs)) {
				Object.keys(attrs).forEach(attr=>{
					const value = attrs[attr];
					exportedAttrs[attr] = value;
				});
			} else if (bolt.isBoolean(attrs)) {
				displayNext = attrs;
			}
		});

	return exportedAttrs;
}

function elementContains(container, element) {
	for (; (element && (element !== document)); element=element.parentNode) {
		if (element === container) return true;
	}
	return false;
}

function getNodeClasses(node) {
	bolt.chain(node.className.split(xSpaces))
		.map(className=>className.trim())
		.uniq()
		.value();
}

module.exports = {
	classNames, attributes, elementContains, getNodeClasses
};