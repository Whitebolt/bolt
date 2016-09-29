'use strict';

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

module.exports = {
  addDefaultObjects, parseTemplatedJson
};