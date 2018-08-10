'use strict';

const xSpaceOrComma = /,| /;
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

function indexOfEquiv(ary, value) {
	return ary.findIndex(_value=>bolt.isEqual(value, _value));
}

function toBool(value, defaultTrueValues=_defaultTrue, defaultFalseValues=_defaultFalse) {
	if (~indexOfEquiv(defaultFalseValues, value)) return false;
	if (~indexOfEquiv(defaultTrueValues, value)) return true;
	return value;
}

function toSet(value, toLower=false) {
	return new Set(bolt.chain(value.split(xSpaceOrComma))
		.map(value=>(toLower?value.toLowerCase():value).trim())
		.filter(value=>(value !== ''))
		.value()
	);
}

function toInteger(value, defaultValue=0) {
	if ((value === '')||(value === undefined)) return defaultValue;
	const _value = parseInt(value, 10);
	return Number.isNaN(_value) ? defaultValue : _value;
}


module.exports = {
	toBool, toSet, toInteger
};