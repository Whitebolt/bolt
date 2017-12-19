'use strict';
// @annotation browser-export

/**
 * @module bolt/bolt
 */

const dateFormat = require('dateformat');

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
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'.split('');
  if (! length) length = Math.floor(Math.random() * chars.length);
  let str = '';
  for (let i = 0; i < length; i++) str += chars[Math.floor(Math.random() * chars.length)];
  return str;
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
  return value.split(splitter)
      .filter(value=>value)
      .map(value=>value.trim())
      .filter(value=>(value!==''));
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

module.exports = {
  replaceLast, randomString, splitAndTrim, dateFormat, replaceSequence, runTemplate, lop, lopGen
};