'use strict';
// @annotation zone server

/**
 * @module bolt/bolt
 */

const path = require('path');

const xSlash = bolt.memoizeRegExp(/\//g);

const componentLoadSequence = [
	['Hooks', 'loadComponentHooks'],
	['Controllers', 'loadComponentControllers'],
	['ComponentViews','loadComponentViews'],
	['Shortcodes', 'loadComponentShortcodes'],
	['Redux','loadComponentRedux'],
	['Components', 'loadComponentComponents']
];


/**
 * Flow up a component tree constructing the path of the supplied component and returning it.
 *
 * @private
 * @param {BoltComponent} component    The componcomponentt the path of.
 * @returns {string}                   The component path.
 */
function _getComponentPath(component) {
	let compPath = [component.name];
	while (component = component.parent) {
		compPath.unshift((component.componentType !== 'app')?component.name:'');
	}
	return compPath.join('/');
}

/**
 * Get the directory path for a component relative to the root it was loaded from.
 *
 * @private
 * @param {BoltComponent} component  The component to get the file path of.
 * @returns {string}                 The component file path.
 */
function _getRelativeDirectoryPathForComponent(component) {
	return xSlash.replace(component.path, '/components/');
	//return component.path.replace(xSlash, '/components/');
}

/**
 * @class BoltComponent
 * @property {BoltComponent|BoltApplication} parent   The component parent.
 * @property {string} name                            The component name.
 * @property {Set} fullPath                           The full paths of each component root loaded into this component.
 * @property {string} componentType                   The component type will always be "component".
 * @property {Object} controllers                     Object referencing all the component controllers.
 * @property {Object} views                           Object referencing all the component views.
 * @property {Object} components                      Object referencing all the component components.
 * @property {string} path                            The component path.
 * @property {string} filePath                        The relative file path (from respective root) used to
 *                                                    load component data.
 */
class BoltComponent {
	constructor(parent, name, fullPath) {
		Object.defineProperties(this, {
			parent: {enumerable: true, configurable: false, value: parent, writable: false},
			name: {enumerable: true, configurable: false, value: name, writable: false},
			fullPath: {enumerable: true, configurable: false, value: new Set([fullPath]), writable: false},
			componentType: {enumerable: true, configurable: false, value: 'component', writable: false},
			controllers: {enumerable: true, configurable: false, value: {}, writable: false},
			views: {enumerable: true, configurable: false, value: {}, writable: false},
			components: {enumerable: true, configurable: false, value: {}, writable: true}
		});

		Object.defineProperty(this, 'path', {enumerable: true, configurable: false, value: _getComponentPath(this), writable: false});
		Object.defineProperty(this, 'filePath', {enumerable: true, configurable: false, value: _getRelativeDirectoryPathForComponent(this), writable: false});
	}
}

/**
 * Create a new component object.
 *
 * @private
 * @param {BoltComponent|BoltApplication} app        The application object (or component) to attach instance to.
 * @param {string} fullPath                          The full directory path of the component.
 * @returns {BoltComponent}                          The component object.
 */
function _createComponent(app, fullPath) {
	let name = path.basename(fullPath);

	if (app.components.hasOwnProperty(name)) {
		let component = app.components[name];
		component.fullPath.add(fullPath);
		return component
	} else {
		app.components[name] = new BoltComponent(app, name, fullPath);
		return app.components[name];
	}
}

/**
 * Get the component directories to load from in load order.
 *
 * @private
 * @param {Array.<string>} roots     The root directories to search from.
 * @returns {Promise.<string[]>}     Promise resolving to an array of full paths to load from.
 */
async function _getComponentDirectories(roots) {
	const componentDirs = await bolt.directoriesInDirectory(roots, ['components']);
	const dirs = await Promise.all(componentDirs.map(async (dirPath)=>bolt.directoriesInDirectory(await dirPath)));

	return bolt.flattenDeep(dirs);
}

/**
 * Load components in app from specified roots.
 *
 * @private
 * @param {BoltApplication|BoltComponent} app             The application object.
 * @param {Array.<string>} roots                         The roots to load from.
 * @returns {Promise.<BoltApplication|BoltComponent>}    Promise fulfilled when all done.
 */
async function _loadComponents(app, roots) {
	bolt.addDefaultObjects(app, 'components');

	const componentDirectories = await _getComponentDirectories(roots);
	await bolt.mapAsync(componentDirectories, async (fullPath)=>{
		const component = _createComponent(app, fullPath);
		await Promise.all(componentLoadSequence.map(
			([loadName, eventName])=>bolt.emitThrough(
				()=>bolt[`load${loadName}`](component, fullPath), eventName, app
			)
		));
	});
}

/**
 * Load components from the given roots into the given app.
 *
 * @param {BoltApplication|BoltComponent} app           The application object (or component).
 * @param {Array.<string>} [roots=app.config.roots]     The roots to load from.
 * @returns {Promise.<BoltApplication|BoltComponent>}   Promise resolving to the supplied app object.
 */
async function loadComponents(app, roots=app.config.root) {
	let fireEvent = 'loadComponents' + (!app.parent?',loadAllComponents':'');
	await bolt.emitThrough(()=>_loadComponents(app, roots), fireEvent, app);

	// You need to know when all the hooks (and hooks on hooks) that run after loadAllComponents have completed.
	if (!app.parent) await bolt.emit('loadAllComponentsDone', app);
	return app;
}


module.exports = {
	loadComponents, BoltComponent
};