'use strict';
// @annotation zone browser server

const _defaultTrue = [
	'true', 'True', 'TRUE',
	'on', 'On', 'ON',
	'yes', 'Yes', 'Yes',
	1, '1',
	true,
	true, true
];
const _defaultFalse = [
	'false', 'False', 'FALSE',
	'off', 'Off', 'OFF',
	'no', 'No', 'NO',
	0, '0',
	false,
	null, undefined
];

const _opposites = new Map([
	..._defaultTrue.map((trueValue, n)=>[trueValue, _defaultFalse[n]]),
	..._defaultFalse.map((falseValue, n)=>[falseValue, _defaultTrue[n]])
]);

/**
 * @module bolt/bolt
 */


/**
 * Convert a text value to a boolean if it is in the list of matched values or return the original value.
 *
 * @public
 * @param {*} value                                                   Value to convert.
 * @param {Array} defaultTrueValues=bolt.getDefault('bool.true')]     Default true values.
 * @param {Array} defaultFalseValues=bolt.getDefault('bool.false')]   Default false values.
 * @returns {boolean|*}   Boolean value or original value.
 */
function toBool(value, defaultTrueValues=_defaultTrue, defaultFalseValues=_defaultFalse) {
	if (~bolt.indexOfEquiv(defaultFalseValues, value)) return false;
	if (~bolt.indexOfEquiv(defaultTrueValues, value)) return true;
	return value;
}

function boolToggle(value, defaultTrueValues=_defaultTrue, defaultFalseValues=_defaultFalse) {
	const opposites = (((defaultTrueValues !== _defaultTrue) || (defaultFalseValues !== _defaultFalse)) ? 		new Map([
			...defaultTrueValues.map((trueValue, n)=>[trueValue, defaultFalseValues[n]]),
			...defaultFalseValues.map((falseValue, n)=>[falseValue, defaultTrueValues[n]])
		]) :
		_opposites
	);
	if (opposites.has(value)) return opposites.get(value);
	return !value;
}

module.exports = {
	toBool, boolToggle
};