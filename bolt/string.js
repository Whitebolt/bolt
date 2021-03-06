'use strict';
// @annotation zone browser server manager gulp

/**
 * @module bolt/bolt
 */

const dateFormat = require('dateformat');
const {xSubstitutions, chars, xEs6SubstitutionsStart} = bolt.consts || require('./consts');

/**
 * Replace the last string within a string.
 *
 * @public
 * @param {string} txt        Text string to search.
 * @param {string} searcher   What to search for.
 * @param {string} replacer   What to replace with.
 * @returns {string}          The original text with the last occurrence of 'search' replaced with 'replace'.
 */
function replaceLast(txt, searcher, replacer) {
	const n = txt.lastIndexOf(searcher);
	return txt.slice(0, n) + txt.slice(n).replace(searcher, replacer);
}

/**
 * Generate a random string of specified length.
 *
 * @todo    Use some sort of generic algorithm instead of this one (perhaps a stock node module).
 * @todo    Add more options such as hex string.
 *
 * @public
 * @param {integer} [length=32] The length of string to return.
 * @returns {string}            The random string.
 */
function randomString(length=32) {
	return (new Array(length)).fill(0).map(()=>chars[bolt.random(chars.length - 1)]).join('');
}

/**
 * Split a string using the given separator and trim the array items of leading/trailing spaces. Also remove
 * empty items.
 *
 * @public
 * @param {string} value      Text to split and trim.
 * @param {string} splitter   Splitter character(s).
 * @returns {Array}           Split and trimmed array.
 */
function splitAndTrim(value, splitter) {
	return bolt.chain(value.split(splitter))
		.filter(value=>value)
		.map(value=>value.trim())
		.filter(value=>(value!==''))
		.value();
}

/**
 * Perform a series of replacements on a string in sequence.
 *
 * @public
 * @param {string|*} [txt]      Text to do replacements on.  If it is not a string try to convert to string
 *                              via toString() method.
 * @param {Array} sequence      Replacement sequence as an array in format
 *                              [[<search-for>,<replacement>], [<search-for>,<replacement>]]. If replacement is not
 *                              present then replace with a blank string. If txt is not supplied then return a
 *                              replacer function that will accept text perform the given replacements.
 * @returns {string}            Replacement text.
 */
function replaceSequence(txt, sequence) {
	let _sequence = (sequence?sequence:txt);

	let _replaceSequence = txt=>{
		let _txt = (bolt.isString(txt) ? txt : txt.toString());
		_sequence.forEach(operation=>{
			_txt = _txt.replace(operation[0], operation[1] || '');
		});
		return _txt;
	};

	return (sequence?_replaceSequence(txt):_replaceSequence)
}

function runTemplate(strTxt, data) {
	const params = Object.keys(data);
	params.push('return `'+strTxt+'`;');
	const template = new Function(...params);
	return template(...bolt.values(data));
}

function lop(text, seperator='/') {
	const parts = text.split(seperator);
	parts.pop();
	return parts.join(seperator)
}

function lopGen(text, seperator='/') {
	let _text = text;
	return function*() {
		while (_text.length) {
			yield _text;
			_text = lop(_text, seperator='/');
		}
	};
}

function substituteCSP(txt, obj=(bolt.isObject(txt)?txt:{}), matcher=xSubstitutions) {
	if (bolt.isObject(txt)) return JSON.parse(substituteCSP(JSON.stringify(txt), obj, matcher));

	let match;
	let count = 0;
	while (match = matcher.exec(txt)) {
		if (bolt.has(obj, match[1])) {
			txt = txt.replace(match[0], bolt.get(obj, match[1]));
			count++;
		}
	}

	return ((count>0)?substituteCSP(txt, obj, matcher):txt);
}

function substituteEs6(txt, obj={}) {
	try {
		return (new Function(
			'config',
			'return `' + txt.replace(xEs6SubstitutionsStart,'${config.') + '`;'
		))(obj);
	} catch (error) {
		return txt;
	}
}

function upperCamelCase(value) {
	const _value = bolt.camelCase(value);
	return _value.charAt(0).toUpperCase() + _value.slice(1);
}


module.exports = {
	replaceLast, randomString, splitAndTrim, dateFormat, replaceSequence, runTemplate, lop, lopGen,
	substituteCSP, upperCamelCase, substituteEs6
};