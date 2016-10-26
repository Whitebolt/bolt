'use strict';

const Promise = require('bluebird');
const parser = require('shortcode-insert')();

function parseShortcodes(component, doc, properties=[]) {
  return Promise.all(properties.map(property=>{
    if (doc.hasOwnProperty(property)) {
      return parser.parse(doc[property], component).then(txt=>{
        doc[property] = txt;
      });
    }
  }));
}

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