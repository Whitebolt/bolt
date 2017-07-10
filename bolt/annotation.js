'use strict';

/**
 * @module bolt/bolt
 */

const string = require('./string');

const {Memory} = require('map-watch');
const _memory = new Memory();
const xSourceGetBlockStart = /^.*?\{/;
const xSourceGetBlockEnd = /\}.*?$/;
const xStartsWithAnnotationDef = /^\s*?\/\/\s*?\@annotation/;
const xGetAnnotation = /.*?\@annotation\s+(.*?)\s(.*)/;
const getSourceClosure = string.replaceSequence([[xSourceGetBlockStart],[xSourceGetBlockEnd]]);
const __undefined = Symbol('undefined');

/**
 * Set an annotation against an object.  Generally, we would pass a function in here but in theory any object that is
 * acceptable as a key-reference in a WeakMap can be used.
 *
 * If a value is given, assume we want to set a key; whereas with no value, assume a get.
 *
 * @note A symbol called __undefined is used here for default parameter values.  This is so the actual value of
 * undefined can be based in ant be seen as no value passed.
 *
 * @public
 * @param {Function|Object} ref                       Reference object, usually an function.
 * @param {string|Object} key                         Annotation name to set on given function/object. If this is an
 *                                                    object, cycle through  the key/values to set each in the
 *                                                    annotation lookup.
 * @param {*} [value=__undefined]                     The value to set for given key against given reference.  If key
 *                                                    is an object then this should be undefined and is ignored anyway.
 *                                                    If value is equal to Symbol('undefined') then assume we wish to
 *                                                    get an annotation, not set it.
 * @returns {*|Map}                                   The key value (if no value given) or the Map for given reference.
 */
function annotation(ref, key, value=__undefined) {
  if (value === __undefined) {
    if (!bolt.isString(key)) return Object.keys(key).map(_key=>_memory.set(ref, _key, key[_key]));
    return _memory.get(ref, key);
  }
  return _memory.set(ref, key, value);
}

annotation.forEach = _memory.forEach.bind(_memory);

/**
 * Get annotations from the source of the given function and set them against it.
 *
 * @example "@annotation visibility private" will set the visibility key to private for given function/object reference.
 *
 * @public
 * @param {Function|string} func        Function or source code of function to get from.
 * @param {Function|Object} [ref=func]  Reference to set annotation against.  Defaults to the given function.
 */
function annotationsFromSource(func, ref=func) {
  let source = getSourceClosure(func).trim();

  if (xStartsWithAnnotationDef.test(source)) {
    let lines = source.split(/\n/).filter(line=>(line.trim() !== ''));
    let current = 0;
    while (xStartsWithAnnotationDef.test(lines[current])) {
      let [undefined, propertyName, value] = xGetAnnotation.exec(lines[current]);
      value = bolt.toBool(value);
      if (bolt.isNumeric(value)) value = bolt.toTypedNumber(value);
      annotation(ref, propertyName, value);
      current++;
    }
  }
}

module.exports = {
  annotation, annotationsFromSource
};