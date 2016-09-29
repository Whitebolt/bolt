'use strict';

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
 * @returns {string}          The original text with the last occurrence of
 *                            'search' replaced with 'replace'.
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
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'.split('');

  if (! length) {
    length = Math.floor(Math.random() * chars.length);
  }

  var str = '';
  for (var i = 0; i < length; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}

/**
 * Split a string using the given separator and trim the array items of
 * leading/trailing spaces. Also remove empty items.
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


module.exports = {
  replaceLast, randomString, splitAndTrim, dateFormat
};