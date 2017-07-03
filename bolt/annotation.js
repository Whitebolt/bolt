'use strict';

const __lookup = new WeakMap();
const __undefined = Symbol("undefined");
const xSourceGetBlockStart = /^.*?\{/;
const xSourceGetBlockEnd = /\}.*?$/;
const xStartsWithMetaDef = /^\s*?\/\/\s*?\@annotation/;
const xGetMeta = /.*?\@annotation\s+(.*?)\s(.*)/;

function annotation(ref, key=__undefined, value=__undefined) {
  let _lookup = __lookup.get(ref);
  if (!_lookup) {
    __lookup.set(ref, new Map());
    _lookup = __lookup.get(ref);
  }

  if (key === __undefined) return _lookup;
  if (bolt.isString(key)) {
    if (value !== __undefined) _lookup.set(key, value);
    return _lookup.get(key);
  } else {
    Object.keys(key).forEach(_key=>_lookup.set(_key, key[_key]));
    return _lookup;
  }
}

function annotationsFromSource(func, ref) {
  let source = (bolt.isString(func) ? func : func.toString())
    .replace(xSourceGetBlockStart,'')
    .replace(xSourceGetBlockEnd,'')
    .trim();

  if (xStartsWithMetaDef.test(source)) {
    let lines = source.split(/\n/).filter(line=>(line.trim() !== ''));
    let current = 0;
    while (xStartsWithMetaDef.test(lines[current])) {
      let [undefined, propertyName, value] = xGetMeta.exec(lines[current]);
      value = bolt.toBool(value);
      if (bolt.isNumeric(value)) value = bolt.toTypedNumber(value);
      annotation(ref || func, propertyName, value);
      current++;
    }
  }
}

module.exports = {
  annotation, annotationsFromSource
};