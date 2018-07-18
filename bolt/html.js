'use strict';
// @annotation zone browser server

/**
 * @module bolt/bolt
 */

const entityParser = require('html-entities').Html5Entities;

const {xSpaces} = bolt.consts;

function classNames(...classes) {
	return (bolt.chain(classes)
		.flattenDeep()
		.map(className=>{
			if (!className) return;
			if (bolt.isFunction(className)) return classNames(className());
			if (bolt.isString(className)) return className.split(' ');
			if (bolt.isObject(className)) return bolt.chain(className)
				.map(className, (value, className)=>{
					if (value) return className;
				})
				.filter(value=>!!value)
				.value();
		})
		.filter(value=>!!value)
		.flattenDeep()
		.uniq()
		.map(className=>className.trim())
		.value()
	).join(' ');
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
		})
		.value();

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
	classNames, attributes, elementContains, getNodeClasses,
	entityEncode: entityParser.encode,
	entityDecode: entityParser.decode
};