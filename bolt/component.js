'use strict';

/**
 * @module bolt/bolt
 */

const path = require('path');
const Promise = require('bluebird');

const xSlash = /\//g;
const componentDefaultObjects = ['controllers', 'views', 'components'];

/**
 * Flow up a component tree constructing the path of the supplied component and
 * returning it.
 *
 * @private
 * @param {Object} component    The component to get the path of.
 * @returns {string}            The component path.
 */
function _getComponentPath(component) {
  let compPath = [component.name];
  while (component = component.parent) compPath.unshift(component.name);
  return compPath.join('/');
}

/**
 * Get the directory path for a component relative to the root it was
 * loaded from.
 *
 * @private
 * @param {Object} component  The component to get the file path of.
 * @returns {string}          The component file path.
 */
function _getRelativeDirectoryPathForComponent(component) {
  return component.path.replace(xSlash, '/components/');
}

/**
 * Initiate the component object with all its default properties.
 *
 * @private
 * @param {Object} app        The application object.
 * @param {string} name       The name of the component.
 * @param {string} fullPath   The full file path to the component.
 * @returns {Object}          The component object.
 */
function _initComponentProperties(app, name, fullPath) {
  let component = app.components[name];
  component.parent = app;
  component.name = name;
  component.fullPath = fullPath;
  component.path = _getComponentPath(component);
  component.filePath = _getRelativeDirectoryPathForComponent(component);
  return bolt.addDefaultObjects(component, componentDefaultObjects);
}

/**
 * Create a new component object.
 *
 * @private
 * @param {Object} app        The application object (or component) to attach
 *                            created object to.
 * @param {string} dirPath    The full directory path of the component.
 * @returns {Object}          The component object.
 */
function _createComponent(app, dirPath) {
  let componentName = path.basename(dirPath);
  bolt.addDefaultObjects(app.components, componentName);
  return _initComponentProperties(app, componentName, dirPath);
}

/**
 * Get the component directories to load from in load order.
 *
 * @private
 * @param {Array} roots   The root directories to search from.
 * @returns {Promise}     Promise resolving to an array of full paths
 *                        to load from.
 */
function _getComponentDirectories(roots) {
  return bolt.directoriesInDirectory(roots, ['components'])
    .mapSeries(dirPath=>bolt.directoriesInDirectory(dirPath))
    .then(dirPaths=>bolt.flattenDeep(dirPaths));
}

/**
 * Load components in app from specified roots.
 *
 * @private
 * @param {Object} app    The application object.
 * @param {Array} roots   The roots to load from.
 * @returns {Promise}     Promise fulfilled when all done.
 */
function _loadComponents(app, roots) {
  bolt.addDefaultObjects(app, 'components');

  return _getComponentDirectories(roots).mapSeries(dirPath=>{
      let component = _createComponent(app, dirPath);
      return Promise.all([
        bolt.fire(()=>bolt.loadHooks(component, component.fullPath), 'loadComponentHooks', app),
        bolt.fire(()=>bolt.loadControllers(component, component.fullPath), 'loadComponentControllers', app),
        bolt.fire(()=>bolt.loadComponentViews(component, component.fullPath), 'loadComponentViews', app),
        bolt.fire(()=>bolt.loadComponents(component, component.fullPath), 'loadComponentComponents', app)
      ]).then(()=>component)
  }).mapSeries(
    component=>bolt.fire(()=>bolt.loadComponents(component, component.fullPath), 'loadComponentComponents', app)
  );
}

/**
 * Load components from the given roots into the given app.
 *
 * @param {Object} app                      The application object (or component).
 * @param {Array} [roots=app.config.roots]  The roots to load from.
 * @returns {Promise}                       Promise resolving to the supplied
 *                                          app object.
 */
function loadComponents(app, roots=app.config.root) {
  let fireEvent = 'loadComponents' + (!app.parent?',loadAllComponents':'');
  return bolt.fire(()=>_loadComponents(app, roots), fireEvent, app).then(() => app);
}

module.exports = {
  loadComponents
};