'use strict';

const $private = new WeakMap();
const requests = new WeakMap();

/**
 * Get all the property names (including inherited) of the given object.
 *
 * @public
 * @param {Object} obj		The object to get properties for.
 * @returns {Set}			A set of all the property names.
 */
function getAllPropertyNames(obj) {
	const all = new Set();

	do {
		Object.getOwnPropertyNames(obj).forEach(property=>all.add(property));
	} while (obj = Object.getPrototypeOf(obj));

	return all;
}


/**
 * Given a collection, test whether an item exists and if not use the given constructor and constructor parameters
 * to create the value.  The collection can be a Set, Map, Array or Object.
 *
 * @param {Map|Set|Array|Object} collection		The collection to test and set on.
 * @param {string} item							The item to set.
 * @param {Object} constructor					The constructor to use.
 * @param {Array.<*>} [...constructorParams]	The parameters to use on the constructor.
 * @returns {*}
 */
function hasConstruct(collection, item, constructor, ...constructorParams) {
	if (constructor) {
		if (collection.has && !collection.has(item)) {
			if (collection.set) return collection.set(item, new constructor(...constructorParams));
			if (collection.add) return collection.add(new constructor(...constructorParams));
		} else if(Array.isArray(collection) && !collection.includes(item)) {
			collection.push(new constructor(...constructorParams));
		} else if (!getAllPropertyNames(collection).has(item)) {
			collection[item] = new constructor(...constructorParams);
		}
	}
}

/**
 * Class for maintaining private values in a given class.
 *
 * @class
 */
class Private {
	/**
	 * Get a given private value on the given class instance.  A constructor can be supplied with construct
	 * arguments if the value does not exist. If no values exist for given instance create a new value map for
	 * future use.
	 *
	 * @static
	 * @method
	 * @public
	 * @param {Object} classInstance				The class instance to get for.
	 * @param {string} property						The property to get.
	 * @param {Object} [defaultConstructor]			The constructor to use for new values.
	 * @param {Array.<*>} [...constructorParams]	The parameters to pass to the constructor.
	 * @returns {*}
	 */
	static get(classInstance, property, defaultConstructor, ...constructorParams) {
		hasConstruct($private, classInstance, Map);
		hasConstruct($private.get(classInstance), property, defaultConstructor, ...constructorParams);
		return $private.get(classInstance).get(property);
	}

	/**
	 * Set a private value on a given class instance.
	 *
	 * @static
	 * @method
	 * @public
	 * @param {Object} classInstance	The class instance to set on.
	 * @param {string} property			The property to set.
	 * @param {*} value					The value to set.
	 * @returns {boolean}				Did the value set?
	 */
	static set(classInstance, property, value) {
		hasConstruct($private, classInstance, Map);
		return $private.get(classInstance).set(property, value);
	}
}


class ControllerInstructions {
	setTrue(key) {
		Private.set(this, key, true);
		return this;
	}

	setFalse(key, value) {
		Private.set(this, key, false);
		return this;
	}

	push(key, values, ...more) {
		const current =  Private.get(this, key, Array);
		if (Array.isArray(current)) {
			current.push(...bolt.makeArray(values).concat(more));
		} else {
			Private.set(this, key, bolt.makeArray(values).concat(more));
		}

		return this;
	}

	unshift(key, values, ...more) {
		const current =  Private.get(this, key, Array);
		if (Array.isArray(current)) {
			current.unshift(...bolt.makeArray(values).concat(more));
		} else {
			Private.set(this, key, bolt.makeArray(values).concat(more));
		}

		return this;
	}

	add(key, values, ...more) {
		const current =  Private.get(this, key, Set);
		if (current instanceof Set) {
			[...values].concat(more).forEach(value=>current.add(value));
		} else {
			Private.set(this, key, new Set(bolt.makeArray(values).concat(more)));
		}
		return this;
	}

	set(key, value) {
		Private.set(this, key, value);
		return this;
	}

	get(key) {
		return Private.get(this, key);
	}
}

function controllerInstruction(instructions, path) {
  if (!instructions.has(path)) instructions.set(path, new ControllerInstructions());
  return instructions.get(path);
}

function controllerInstructions(req) {
  const _req = req.__unproxied || req;
  if (!requests.has(_req)) requests.set(_req, new Map());
  return requests.get(_req);
}

module.exports = req=>{
  const instructions = controllerInstructions(req);
  return path=>controllerInstruction(instructions, path);
};