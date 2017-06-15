'use strict';

const Promise = require('bluebird');
const parser = require('shortcode-insert')();

/**
 * Parse shortcodes in a given document.
 *
 * @param {Object} component    Component object that the shortcode relates to.
 * @param doc {Object}          Document to parse for shortcodes.
 * @param properties            Document properties to parse shortcodes in.
 * @returns {Promise}           Promise resolving when all shortcode parsing done.
 */
function parseShortcodes(component, doc, properties=[]) {
  return Promise.all(properties.map(property=>{
    if (doc.hasOwnProperty(property)) {
      return parser.parse(doc[property], component).then(txt=>{
        doc[property] = txt;
      });
    }
  }));
}

/**
 * Load shortcode parsing functions into app.
 *
 * @param {Object} component    Component object to import shortcodes into.
 * @param {string|Array} roots  Root folder(s) to search for shortcode functions in.
 * @param {Object} importObject Object to import into.
 * @returns {Promise}           Promise resolving to the supplied component.
 */
function loadShortcodes(component, roots=bolt.getApp(component).config.root, importObj=bolt.getApp(component).shortcodes) {
  return bolt
    .importIntoObject({roots, importObj, dirName:'shortcodes', eventName:'loadedShortcode'})
    .then(()=>{
      Object.keys(importObj).forEach(tag=>{
        if (bolt.isFunction(importObj[tag])){
          parser.add(tag, importObj[tag], false);
        } else if (bolt.isPlainObject(importObj[tag])) {
          parser.add(importObj[tag].tag || importObj[tag].regex || importObj[tag].test, importObj[tag].handler, false);
        }
      });
      return component;
    });
}

module.exports = {
  loadShortcodes, parseShortcodes
};