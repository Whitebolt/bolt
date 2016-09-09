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

function objectToQueryString(obj, splitter='&', defaultValue=undefined) {
  let queryString = [];

  Object.keys(obj).forEach(key=>{
    queryString.push(encodeURIComponent(key) + (((obj[key] !== defaultValue) && (obj[key] !== ''))? '='+encodeURIComponent(obj[key]) : ''));
  });

  return queryString.join(splitter);
}

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

function getUrlQueryObject(obj) {
  let parts = url.split('?');
  if (parts.length > 1) {
    return queryStringToObject(parts[1]);
  }
  return {};
}

function addQueryObjectToUrl(url, obj) {
  let parts = url.split('?');
  if (parts.length > 1) {
    parts[1] = objectToQueryString(Object.assign(queryStringToObject(parts[1]), obj));
    return parts.join('?');
  }
  parts = url.split('#');
  let queryString = objectToQueryString(obj);
  parts[0] += ((queryString.trim() !== '') ? '?'+queryString : '');
  return parts.join('#');
}

module.exports = {
  getPathFromRequest, getPathPartsFromRequest, objectToQueryString, queryStringToObject,
  addQueryObjectToUrl, getUrlQueryObject
};