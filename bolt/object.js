'use strict';

const __lookup = new WeakMap();
const __undefined = Symbol("undefined");
const xSourceGetBlockStart = /^.*?\{/;
const xSourceGetBlockEnd = /\}.*?$/;
const xStartsWithMetaDef = /^\s*?\/\/\s*?\@meta/;
const xGetMeta = /.*?\@meta\s+(.*?)\s(.*)/;

/**
 * @module bolt/bolt
 */

/**
 * Add new objects to and object if not already present.  Will construct a
 * series of blank objects attached to the property names supplied. If
 * properties already exist, leave as.
 *
 * @public
 * @param {Object} obj                      Object to work on.
 * @param {Array|string} properties         Properties to set.
 * @param {boolean} [defaultIsArray=false]  Set to blank array instead of blank
 *                                          object, if true.
 * @returns {Object}                        The original object returned
 *                                          for chaining.
 */
function addDefaultObjects(obj, properties, defaultIsArray=false) {
  (
    bolt.isString(properties) ?
      bolt.splitAndTrim(properties, ',') :
      properties
  ).forEach(prop=>{
    obj[prop] = obj[prop] || (defaultIsArray?[]:{});
  });
  return obj;
}

/**
 * Parse a json string/object applying each property as a template with itself
 * as the source.  This means that properties can refer to each other with
 * values being constructed from other properties.  Uses lodash templates for
 * template parsing. Parses recursively until all values are replaced.
 *
 * @param {Object|string} jsonString    Object or string that is json. This
 *                                      is the input to parse.
 * @returns {Object}                    The parsed object.
 */
function parseTemplatedJson(jsonString) {
  let _jsonString = (bolt.isString(jsonString)?JSON.parse(jsonString):jsonString);
  let configText = (bolt.isString(jsonString)?jsonString:JSON.stringify(jsonString));
  let configTextOld = '';
  let template = bolt.template(configText);
  while (configText !== configTextOld) {
    _jsonString = JSON.parse(template(_jsonString));
    configTextOld = configText;
    configText = JSON.stringify(_jsonString);
    template = bolt.template(configText);
  }

  return _jsonString;
}

/**
 * Deep pick function, similar to lodash.pick but with the facility to pick deeply.
 *
 * @param {Object} obj          Object to pick from.
 * @param {Array} properties    Properties to pick.
 * @returns {Object}            Object with picked properties.
 */
function pickDeep(obj, properties) {
  let _obj = {};
  bolt.makeArray(properties).forEach(property=> {
    if (bolt.has(obj, property)) bolt.set(_obj, property, bolt.get(obj, property))
  });
  return _obj;
}

function meta(ref, key=__undefined, value=__undefined) {
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

function metaFromSource(ref) {
  if (bolt.isFunction(ref)) {
    let source = ref.toString().replace(xSourceGetBlockStart,'').replace(xSourceGetBlockEnd,'').trim();

    if (xStartsWithMetaDef.test(source)) {
      let lines = source.split(/\n/).filter(line=>(line.trim() !== ''));
      let current = 0;
      while (xStartsWithMetaDef.test(lines[current])) {
        let [undefined, propertyName, value] = xGetMeta.exec(lines[current]);
        value = bolt.toBool(value);
        if (bolt.isNumeric(value)) value = bolt.toTypedNumber(value);
        meta(ref, propertyName, value);
        current++;
      }
    }
  }
}

module.exports = {
  addDefaultObjects, parseTemplatedJson, pickDeep, meta, metaFromSource
};