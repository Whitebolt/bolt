'use strict';
// @annotation zone server

const parser = require('shortcode-insert')();

/**
 * Parse shortcodes in a given document.
 *
 * @public
 * @param {BoltComponent} component    Component object that the shortcode relates to.
 * @param doc {Object}                 Document to parse for shortcodes.
 * @param [properties=[]]              Document properties to parse shortcodes in. Optional, if not supplied just
 *                                     returns fulfilled promise.
 * @returns {Promise}                  Promise resolving when all shortcode parsing done.
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
 * @public
 * @param {BoltComponent} component         Component object to import shortcodes into.
 * @param {string|Array.<string>} [roots]   Root folder(s) to search for shortcode functions in. Defaults to the current
 *                                          app root folders.
 * @param {Object} [importObject]           Object to import into. Defaults to all of the current app shortcodes.
 * @returns {Promise.<BoltComponent>}       Promise resolving to the supplied component.
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