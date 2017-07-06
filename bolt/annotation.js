'use strict';

/**
 * @module bolt/bolt
 */

const string = require('./string');

const Memory = require('./memory').Memory;
const _memory = new Memory();
const __undefined = Symbol("undefined");
const xSourceGetBlockStart = /^.*?\{/;
const xSourceGetBlockEnd = /\}.*?$/;
const xStartsWithAnnotationDef = /^\s*?\/\/\s*?\@annotation/;
const xGetAnnotation = /.*?\@annotation\s+(.*?)\s(.*)/;
const getSourceClosure = string.replaceSequence([[xSourceGetBlockStart],[xSourceGetBlockEnd]]);

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
 * @param {string|Object|Symbol} [key=__undefined]    Annotation name to set on given function/object.  If set to
 *                                                    __undefined then return the Map object, referenced by ref.
 * @param {*} [value=__undefined]                     The value to set for given key against given reference.
 * @returns {*|Map}                                   The key value (if no value given) or the Map for given reference.
 */
function annotation(ref, key=__undefined, value=__undefined) {
  let _lookup = _memory.get(ref);
  if (key === __undefined) return _lookup;
  if (bolt.isString(key)) {
    if (value !== __undefined) _lookup.set(key, value);
    return _lookup.get(key);
  } else {
    Object.keys(key).forEach(_key=>_lookup.set(_key, key[_key]));
    return _lookup;
  }
}

/**
 * Get annotations from the source of the given function and set them against it.
 *
 * @example "@annotation visibility private" will set the visibility key to private for given function/object reference.
 *
 * @public
 * @param {Function|string} func        Function or source code of function to get from.
 * @param {Function|Object} [ref=func]  Reference to set annotation against.  Defaults to the given function.
 * @returns {Map|undefined}             The annotations maps for the given reference function/object.
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

  return annotation(ref);
}

module.exports = {
  annotation, annotationsFromSource
};