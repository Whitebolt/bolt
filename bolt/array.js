'use strict';
// @annotation zone browser server manager


/**
 * @module bolt/bolt
 */

/**
 * Convert a non-array to an array using the formula: if =undefined then make empty array, otherwise create new array
 * making the first item the supplied value.
 *
 * @private
 * @param {*} ary     Value to convert.
 * @returns {Array}   Converted value.
 */
function _makeArrayConvertFunction(ary) {
	return ((ary===undefined)?[]:[ary]);
}

/**
 * Always return an array.  If the provided parameter is an array then return it as-is.  If provided param is not an
 * array return param as first item of an array. If a convertFunction is supplied the default non-array to array
 * conversion can be overridden.
 *
 * Function is useful when you always need a value to be array to use array functions (such as map or forEach) on it
 * but cannot guarantee it will be.
 *
 * Will convert 'undefined' to an empty array.
 *
 * @static
 * @public
 * @param {*} ary                                                   Item to return or convert to an array.
 * @param {function} [convertFunction=_makeArrayConvertFunction]    Function used to convert to an array if not
 *                                                                  already one.
 * @returns {Array}                                                 New array or supplied parameter returned.
 */
function makeArray(ary, convertFunction=_makeArrayConvertFunction) {
	return (Array.isArray(ary) ? ary : convertFunction(ary));
}

function chainArray(ary, convertFunction=_makeArrayConvertFunction) {
	return bolt.chain(makeArray(ary, convertFunction));
}

function makeArrays(obj, props, convertFunction=_makeArrayConvertFunction) {
	makeArray(props).forEach(prop=>{
		obj[prop] = makeArray(obj[prop], convertFunction);
	});
	return obj;
}

/**
 * Sort an array according to it item's priority property.
 *
 * @static
 *
 * @throws {SyntaxError}                When no arguments supplied.
 * @throws {RangeError}                 When direction is set to something other than ASC or DESC.
 * @throws {TypeError}                  When type of first parameter is either an object or string when one parameter
 *                                      supplied.
 *
 * @param {Object|string} a             First sort item. If this is the only parameter then assume a new sorter function
 *                                      is and this is the property to sort on.
 * @param {string} [a.priority]         If only one argument supplied and this property is present return sorter with
 *                                      this as the property to sort on.
 * @param {string} [a.priority2]        If only one argument supplied and this property is present return sorter with
 *                                      this as the secondary property to sort on.
 * @param {string} [b.direction='ASC']  If only one argument supplied and this property is present return a sorter, which
 *                                      sorts according to direction here (either: ASC or DESC).
 * @param {Object} [b]                  Second sort item.
 * @returns {integer|function}          Sort order for items a & b, returns either -1, 0 or 1. If one parameter was
 *                                      supplied then return a sort function instead.
 */
function prioritySorter(a, b) {
	let sortProperty = 'priority';
	let sortProperty2 = 'priority2';
	let direction = 'ASC';

	let sorter = (a, b)=>{
		let aP = (a !== undefined ? (a.hasOwnProperty(sortProperty) ? a[sortProperty] : bolt.annotation.get(a, sortProperty) || 0) : 0);
		let bP = (a !== undefined ? (b.hasOwnProperty(sortProperty) ? b[sortProperty] : bolt.annotation.get(b, sortProperty) || 0) : 0);
		let aP2 = (a !== undefined ? (a.hasOwnProperty(sortProperty2) ? a[sortProperty2] : bolt.annotation.get(a, sortProperty2) || 0) : 0);
		let bP2 = (a !== undefined ? (b.hasOwnProperty(sortProperty2) ? b[sortProperty2] : bolt.annotation.get(b, sortProperty2) || 0) : 0);

		if (direction === 'ASC') {
			return ((aP > bP)?1:((aP < bP)?-1:((aP2 > bP2)?1:((aP2 < bP2)?-1:0))));
		} else if (direction === 'DESC') {
			return ((aP > bP)?-1:((aP < bP)?1:((aP2 > bP2)?1:((aP2 < bP2)?-1:0))));
		} else {
			throw new RangeError('Sort direction for prioritySorter() should be either ASC or DESC');
		}
	};

	if (arguments.length > 1) return sorter(a, b);
	if (arguments.length === 0) {
		throw new SyntaxError('No arguments supplied to prioritySorter()');
	}

	if (bolt.isString(a)) {
		sortProperty = a;
	} else if (bolt.isObject(a)) {
		if (a.hasOwnProperty('sortProperty')) sortProperty = a.sortProperty.toString();
		if (a.hasOwnProperty('sortProperty2')) sortProperty2 = a.sortProperty2.toString();
		if (a.hasOwnProperty('direction')) direction = a.direction.toString().toUpperCase().trim();
		if ((direction !== 'ASC') && (direction !== 'DESC')) {
			throw new RangeError('Sort direction for prioritySorter() should be either ASC or DESC');
		}
	} else {
		throw new TypeError('Wrong argument type supplied as first parameter for prioritySorter()');
	}

	return sorter;
}

/**
 * Find the first index in an array that matches supplied value.  Does a deep equivalence match so arrays and objects can be compared.
 *
 * @static
 * @public
 * @param {Array} ary     The Array to search.
 * @param {*}             The value to search for.
 * @returns {integer}     The index if found; if not found return -1.
 */
function indexOfEquiv(ary, value) {
	return ary.findIndex(_value=>bolt.isEqual(value, _value));
}

function toObjectMap(ary, iteree, context) {
	const _iteree = context?iteree.bind(context):iteree;
	const exportObj = {};

	bolt.makeArray(ary).forEach((item, n, ary)=>{
		const [key, value] = _iteree(item, n, ary);
		exportObj[key] = value;
	});

	return exportObj;
}

function mapReduce(ary, iteree, context=null) {
	const _iteree = iteree.bind(context);
	if (bolt.isArray(ary)) {
		return bolt.chain(ary)
			.map(_iteree)
			.filter(value=>(value !== undefined))
			.value();
	} else if (ary instanceof Set) {
		return bolt.chain([...ary])
			.map(_iteree)
			.filter(value=>(value !== undefined))
			.value();
	} else if (ary instanceof Map) {
		return bolt.chain([...ary.keys()])
			.map(key=>_iteree(ary.get(key), key, ary))
			.filter(value=>(value !== undefined))
			.value();
	} else if (bolt.isObject(ary)) {
		return bolt.chain(ary)
			.keys()
			.map(key=>_iteree(ary[key], key, ary))
			.filter(value=>(value !== undefined))
			.value();
	}
	throw 'mapReduce can only work on arrays, maps, objects and sets.'
}

module.exports = {
	makeArray, makeArrays, chainArray, prioritySorter, indexOfEquiv, toObjectMap, mapReduce
};
