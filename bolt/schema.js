'use strict';

const Joi = require('joi');

/**
 * @module bolt/bolt
 */

/**
 * Load schemas in given directory into the application.
 *
 * @private
 * @param {string|array.<string>} roots    Path to search for schema directory in and then load hooks from.
 * @param {BoltApplication} app            Object to import into.
 * @returns {Promise.<BoltApplication>}    Promise resolving to application.
 */
function _loadSchemas(roots, app) {
  app.schemas = app.schemas || {};
  return bolt
    .importIntoObject({roots, importObj:app.schemas, dirName:'schemas', eventName:'loadedSchema'})
    .then(()=>app);
}

/**
 * Load schemas from schemas directories within the application roots.
 * Filename should be the same as the schemas name.
 *
 * @public
 * @param {BoltApplication} app                       Express application.
 * @param {Array.<string>} [roots=app.config.roots]   Root folders to search in.
 * @returns {Promise.<BoltApplication>}               Promise resolving to supplied express app after loading of
 *                                                    schemas and firing of related events.
 */
function loadSchemas(app, roots=app.config.root) {
  return bolt.emitThrough(()=>_loadSchemas(roots, app), 'loadSchemas', app).then(() => app);
}

module.exports = {
  loadSchemas, Joi
};