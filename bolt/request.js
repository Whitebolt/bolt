'use strict';

/**
 * Get the path from a url removing an trailing slashes.
 *
 * @todo  How robust is this? Test and improve.
 * @todo  How safe is this? Ensure it is safe.
 *
 * @public
 * @param {Object} req      The request (express style) to get path from.
 * @returns {string}        The found path or '/'.
 */
function getPathFromRequest(req) {
  let path = req.path.trim().replace(/\/$/, '');

  return ((path === '') ? '/' : path);
}

/**
 * Split a path into parts return an array of each directory part.
 *
 * @todo  How safe is this? Ensure it is safe.
 *
 * @public
 * @param {Object} req      The request (express style) to get path from.
 * @returns {Array}         The path parts.
 */
function getPathPartsFromRequest(req) {
  return getPathFromRequest(req).split('/').filter(part => (part.trim() !== ''));
}

/**
 * Convert a given object to a url style query string.
 *
 * @public
 * @param {Object} obj              Object to convert.
 * @param {string} [splitter='&']   Splitter between string values.
 * @param {string} [defaultValue]   Default value when key is present but has
 *                                  no value.  If undefined then leave blank.
 *                                  This means you can have properties without
 *                                  values, eg. field1=1&field2&field3
 * @returns {string}                The url query style string.
 */
function objectToQueryString(obj, splitter='&', defaultValue) {
  let queryString = [];

  Object.keys(obj).forEach(key=>{
    queryString.push(encodeURIComponent(key) + (((obj[key] !== defaultValue) && (obj[key] !== ''))? '='+encodeURIComponent(obj[key]) : ''));
  });

  return queryString.join(splitter);
}

/**
 * This is the opposite of objectToQueryString and converts a url query
 * string to an object.
 *
 * @public
 * @param queryString               The query string to parse.
 * @param {string} [splitter='&']   Splitter between string values.
 * @param {string} [defaultValue]   Default value when key is present but has
 *                                  no value.  This defines what the object
 *                                  value is set to for these items.
 * @returns {Object}                The parse query object.
 */
function queryStringToObject(queryString, splitter='&', defaultValue=undefined) {
  let obj = {};
  let parts = queryString.split(splitter);
  parts.forEach(part=>{
    let _parts = part.split('=');
    let key = _parts.shift();
    obj[key] = ((_parts.length) ? _parts.join('=') : defaultValue);
  });
  return obj;
}

/**
 * Get a query object from a given array, avoiding any hash section errors.
 *
 * @public
 * @param {string} url    The url string to parse.
 * @returns {Object}      The query object.
 */
function getUrlQueryObject(url) {
  let parts = url.split('?');
  if (parts.length > 1) {
    return queryStringToObject(parts[1]);
  }
  return {};
}

/**
 * Add a query to the url,maintaining any query already present but add or
 * overwriting from the supplied query object.
 *
 * @public
 * @param {string} url          The url to add to.
 * @param {Objects[]} ...objs   Queries to add to the query string.
 * @returns {string}            The new url.
 */
function addQueryObjectToUrl(url, ...objs) {
  let _obj = Object.assign.apply(Object, objs);
  let parts = url.split('?');
  if (parts.length > 1) {
    parts[1] = objectToQueryString(Object.assign(queryStringToObject(parts[1]), _obj));
    return parts.join('?');
  }
  parts = url.split('#');
  let queryString = objectToQueryString(_obj);
  parts[0] += ((queryString.trim() !== '') ? '?'+queryString : '');
  return parts.join('#');
}

module.exports = {
  getPathFromRequest, getPathPartsFromRequest, objectToQueryString, queryStringToObject,
  addQueryObjectToUrl, getUrlQueryObject
};