'use strict';
// @annotation zone server manager

/**
 * @module bolt/bolt
 */

const path = require('path');
const colour = require('@ccheever/crayon');
const {xTemplateIdAt} = bolt.consts;
const {loadBoltModules} = loadLibModule('loaders');

/**
 *  @external ejsOptions
 *  @see {https://github.com/Whitebolt/ejs/blob/master/lib/ejs.js}
 */


/**
 * Take a config object and register log events according to the the criteria
 * within in.  This is basically way of mapping specfic events to specific log
 * broadcasts.  Normally the input object is taken from package.json.
 *
 * @private
 * @param {boltConfig} config   The config object.
 * @returns {Function}          Unreg function.
 */
function _registerLogEvent(config) {
	const _config = JSON.stringify(config).replace(xTemplateIdAt, '${');
	const channel = '/logging';

	return bolt.on(config.event, (...params) => {
		const level = config.level || 3; // Placed here so level can be changed in-flight.
		try {
			const messageData = JSON.parse(bolt.substituteEs6(_config, {params}));
			return bolt.publish(channel, {
				level,
				type: config.action || config.event,
				description: messageData.description,
				property: messageData.property || params[0],
				style: {
					property: {colour: config.propertyColour || 'yellow'},
					type: {colour: config.typeColour || 'green'},
					description: {colour: config.descriptionColour || 'white'}
				}
			});
		} catch(err) {}
	});
}

/**
 * Setup logging both to the console and to the access logs.
 *
 * @private
 * @param {BoltApplication} app    The express application.
 */
function initLogging(app) {
	app.locals.eventConsoleLogging.forEach(config=>_registerLogEvent(config));
	_initConsoleLogging(app.locals.logLevel, message=>{
		const pc = bolt.get(message, 'data.style.property.colour', 'yellow');
		const tc = bolt.get(message, 'data.style.type.colour', 'green');
		const mc = bolt.get(message, 'data.style.description.colour', 'white');

		const _message = `[${colour[tc](message.data.type)}] ${colour[mc].bold(message.data.description)} ${colour[pc].italic(message.data.property)}`;
		console.log(_message)
	});
	_initAccessLogging(app.locals.accessLog);

	return app;
}

/**
 * Initalise console logging for given log level.
 *
 * @private
 * @param {integer} level       Log level to subscribe to.
 * @param {function} listener   Callback to fire on event.
 */
function _initConsoleLogging(level, listener) {
	bolt.subscribe('/logging', {level: {$gte: level}}, message=>listener(message));
}

/**
 * Initilaise access logging to the given file path.
 *
 * @todo  Handle errors.
 * @todo  Return a close function or handle object.
 *
 * @private
 * @param {string} logPath    Path to log to.
 */
async function _initAccessLogging(logPath) {
	if (logPath) {
		const fd = await bolt.openFile(logPath, 'a', {createDirectories:true});
		bolt.subscribe('/logging/access', (options, message)=>bolt.writeFile(fd, message));
	}
}

/**
 * Create a new express application with the given config object.
 *
 * @private
 * @param {boltConfig} config      A config object.
 * @returns {BoltApplication}      The express application instance.
 */
function _createApp(config) {
	return new BoltApplication(config);
}

async function getComponentDirectories(root) {
	const componentsDirectories = (await bolt.directoriesInDirectory(root, ['components']));
	if (componentsDirectories.length) {
		const componentDirectories = await bolt.directoriesInDirectory(componentsDirectories);
		if (componentDirectories.length) {
			return [...componentDirectories, ... await getComponentDirectories(componentDirectories)];
		}
		return componentDirectories;
	}
	return [];
}

/**
 * Load additional bolt modules (not just the main root ones).  Will only load
 * additional modules, ignoring the main root.
 *
 * @private
 * @param {BoltApplication} app               The application object.
 * @returns {Promise.<BoltApplication>}       Promise resolving to app when all is loaded.
 */
async function _boltLoader(app) {
	const root = [...app.locals.root, ...await getComponentDirectories(app.locals.root)];
	const boltDirectories = (await bolt.directoriesInDirectory(root, ['bolt']))
		.filter(dirPath=>(dirPath !== boltRootDir + '/bolt'));

	await Promise.all(boltDirectories.map(dirPath=>loadBoltModules(
		dirPath,
		{basedir: __dirname, parent: __filename},
		['server']
	)));

	bolt.emit('extraBoltModulesLoaded');

	return app;
}

/**
 * Load a new bolt application using the supplied config path.
 *
 * @private
 * @param {string} configPath                Path to server config.
 * @returns {Promise.<BoltApplication>}      Promise resolving to app object once it is loaded.
 */
function _loadApplication(configPath) {
	return (bolt.isString(configPath) ? require.async(configPath) : Promise.resolve(configPath))
		.then(_createApp)
		.then(initLogging)
		.then(app=>{
			bolt.emit('configLoaded', configPath);
			return app;
		})
		.then(_boltLoader);
}

/**
 * Import a given set of paths into the app.
 *
 * @public
 * @param {Object} options                         Options object for this import.
 * @param {Array.<string>|string} options.roots    Root folder(s) to start imports from.
 * @param {string} options.dirName                 Directory name within each root to import from.
 * @param {Object} options.importObject            The object to import into.
 * @param {string} options.eventName               The event to fire once import is complete.
 * @returns {Promise}
 */
async function importIntoObject(options) {
	const dirs = await bolt.directoriesInDirectory(options.roots, [options.dirName]);
	return Promise.all(dirs.map(async (dirPath)=>{
		const importOptions = Object.assign({}, {
			imports: options.importObj || {},
			onload: filepath=>bolt.emit(options.eventName, filepath),
			basedir: boltRootDir,
			parent: __filename
		}, options.importOptions || {});
		return require.import(await dirPath, importOptions);
	}));
}

/**
 * Get the root parent of the given component object. Scale through the
 * hierarchy till the first object is reached.
 *
 * @param {BoltComponent|BoltApplication} component    Application or component object.
 * @returns {BoltApplication}                                   Express application instance.
 */
function getApp(component) {
	let app = component;
	while (app.parent) app = app.parent;
	return app;
}

/**
 * Load a new bolt application using the given config path, firing the correct
 * initialisation events.
 *
 * @public
 * @static
 *
 * @fires beforeInitialiseApp
 * @fires afterInitialiseApp
 *
 * @param {string} configPath   Path to server config.
 * @returns {Promise}           Promise resolving to app object once it is
 *                              loaded and events fired.
 */
async function loadApplication(configPath) {
	await bolt.emitBefore('initialiseApp');
	const app = await _loadApplication(configPath);
	bolt.MODE = new Set();
	if (app.locals.debug) bolt.MODE.add("DEBUG");
	if (app.locals.development) bolt.MODE.add("DEVELOPMENT");
	if (app.locals.production) bolt.MODE.add("PRODUCTION");
	bolt.LOGLEVEL = app.locals.logLevel;
	bolt.VERSION = {
		lodash:bolt.VERSION,
		bolt:app.locals.version
	};
	await bolt.emitAfter('initialiseApp', configPath, app);
}

/**
 *  @external express:application
 *  @see {https://github.com/expressjs/express/blob/master/lib/application.js}
 *
 *  @class BoltApplication
 *  @extends external:express:application
 *  @property {BoltConfig} config             Configuration object for bolt server.
 *  @property {Object} routers                Routers
 *  @property {Object} controllerRoutes       Controller routes
 *  @property {Object} shortcodes             Shortcodes
 *  @property {Object} templates              Templates
 *  @property {string} componentType          The componernt type, is constant "app".
 */
class BoltApplication extends express {
	constructor(config) {
		super();
		Object.defineProperties(this, {
			routers: {enumerable: true, configurable: false, value: {}, writable: false},
			controllerRoutes: {enumerable: true, configurable: false, value: {}, writable: true},
			shortcodes: {enumerable: true, configurable: false, value: {}, writable: false},
			templates: {enumerable: true, configurable: false, value: {}, writable: false},
			componentType: {enumerable: true, configurable: false, value: 'app', writable: false}
		});
		bolt.merge(this.locals, config);
	}

	get config() {
		console.warn('Using app.config is depreciated, please use app.locals instead.');
		return this.locals;
	}

	set config(value) {
		console.warn('Using app.config is depreciated, please use app.locals instead.');
		return this.config = value;
	}
}

module.exports = {
	loadApplication, getApp, importIntoObject, BoltApplication, initLogging
};
