'use strict';
// @annotation zone browser manager server gulp


/**
 * @module bolt/bolt
 */

/**
 * Add new objects to and object if not already present.  Will construct a
 * series of blank objects attached to the property names supplied. If
 * properties already exist, leave as.
 *
 * @public
 * @param {Object} obj                      Object to work on.
 * @param {Array|string} properties         Properties to set.
 * @param {boolean} [defaultIsArray=false]  Set to blank array instead of blank
 *                                          object, if true.
 * @returns {Object}                        The original object returned
 *                                          for chaining.
 */
function addDefaultObjects(obj, properties, defaultIsArray=false) {
	(
		bolt.isString(properties) ?
			bolt.splitAndTrim(properties, ',') :
			properties
	).forEach(prop=>{
		obj[prop] = obj[prop] || (defaultIsArray?[]:{});
	});
	return obj;
}

/**
 * Perform a freeze on an object, freezing recursively though dependant objects.
 *
 * @param {Object} obj      Object to deep freeze.
 * @returns {Object}        Frozen object.
 */
function deepFreeze(obj) {
	Object.getOwnPropertyNames(obj).forEach(name=>{
		let prop = obj[name];
		if ((typeof prop == 'object') && (prop !== null)) deepFreeze(prop);
	});
	return Object.freeze(obj);
}

/**
 * Parse a json string/object applying each property as a template with itself
 * as the source.  This means that properties can refer to each other with
 * values being constructed from other properties.  Uses lodash templates for
 * template parsing. Parses recursively until all values are replaced.
 *
 * @param {Object|string} jsonString    Object or string that is json. This
 *                                      is the input to parse.
 * @returns {Object}                    The parsed object.
 */
function parseTemplatedJson(jsonString) {
	let _jsonString = (bolt.isString(jsonString)?JSON.parse(jsonString):jsonString);
	let configText = (bolt.isString(jsonString)?jsonString:JSON.stringify(jsonString));
	let configTextOld = '';
	let template = bolt.template(configText);
	while (configText !== configTextOld) {
		_jsonString = JSON.parse(template(_jsonString));
		configTextOld = configText;
		configText = JSON.stringify(_jsonString);
		template = bolt.template(configText);
	}

	return _jsonString;
}

function _forEachKeys(obj, iteree) {
	if (Array.isArray(obj)) {
		obj.forEach((value, key)=>iteree(key))
	} else {
		Object.keys(obj).forEach(key=>iteree(key));
	}
}

function substituteInObject(obj, originalObj) {
	const _obj = (bolt.isString(obj)?JSON.parse(obj):obj);
	const _originalObj = originalObj || _obj;
	const matcher = JSON.stringify(_obj);

	_forEachKeys(_obj, key=>{
		if (bolt.isNull(_obj[key] || bolt.isUndefined(_obj[key]))) return _obj[key];
		if (bolt.isObject(_obj[key]) || Array.isArray(_obj[key])) _obj[key] = substituteInObject(_obj[key], _originalObj);
		if (bolt.isString(_obj[key]) && (~_obj[key].indexOf('${'))) {
			_obj[key] = bolt.substituteEs6(_obj[key], _originalObj);
		}
	});

	return ((JSON.stringify(_obj) !== matcher) ? substituteInObject(_obj, _originalObj) : _obj);
}

/**
 * Deep pick function, similar to lodash.pick but with the facility to pick deeply.
 *
 * @param {Object} obj          Object to pick from.
 * @param {Array} properties    Properties to pick.
 * @returns {Object}            Object with picked properties.
 */
function pickDeep(obj, properties) {
	let _obj = {};
	bolt.makeArray(properties).forEach(property=> {
		if (bolt.has(obj, property)) bolt.set(_obj, property, bolt.get(obj, property))
	});
	return _obj;
}

function pickHas(obj, properties) {
	return bolt.pickBy(bolt.pick(obj, properties), value=>(value !== undefined));
}

function cloneAndMerge(toClone, toMergeIn, picks) {
	return Object.assign({}, toClone, pickDeep(toMergeIn, picks))
}

function toKeyValueArray(obj) {
	return bolt.chain(obj)
		.keys()
		.map(key=>[key, obj[key]])
		.flatten()
		.value();
}

function objectLength(obj) {
	return Object.keys(obj).length;
}

function objectToArgsArray(obj, parent='', args=[]) {
	function processItem(value, propName) {
		if (bolt.isNumber(value) || bolt.isString(value)) {
			args.push(`--${propName}=${value}`);
		} else if (bolt.isNull(value)) {
			args.push(`--${propName}=null`);
		} else if (bolt.isUndefined(value)) {
			args.push(`--${propName}=undefined`);
		} else if (bolt.isObject(value) || bolt.isArray(value)) {
			objectToArgsArray(value, propName, args);
		}
	}

	const iterator = (Array.isArray(obj)?'forEach':'forOwn');

	bolt.chain(obj)
		[iterator]((value, propName)=>{
		const _propName = ((parent === '') ?
				propName :
				`${parent}.${propName}`
		);
		return processItem(value, _propName);
	})
		.value();

	return args;
}

function forOwnOwn(obj, iterator) {
	bolt.forOwn(obj, value=>bolt.forOwn(value, iterator));
	return obj;
}

function forEachOwn(ary, iterator) {
	bolt.forEach(ary, value=>bolt.forOwn(value, iterator));
	return ary;
}


module.exports = {
	addDefaultObjects, toKeyValueArray, parseTemplatedJson, pickDeep, deepFreeze, substituteInObject,
	cloneAndMerge, pickHas, objectLength, objectToArgsArray, forOwnOwn, forEachOwn
};