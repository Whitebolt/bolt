'use strict';
// @annotation zone server manager

/**
 * @module bolt/bolt
 */

const ejs = require('@simpo/ejs');
const path = require('path');

const chalk = require('chalk');

/**
 *  @external ejsOptions
 *  @see {https://github.com/Whitebolt/ejs/blob/master/lib/ejs.js}
 */

/**
 * @type {external:ejsOptions}
 */
const ejsOptions = Object.freeze({
	strict: true,
	localsName: ['params'],
	awaitPromises: true,
	_with: false
});

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
	let description = ejs.compile(config.description, ejsOptions);
	let property = config.property?ejs.compile(config.property, ejsOptions):undefined;

	return bolt.on(config.event, (...params) => {
		let level = config.level || 3; // Placed here so level can be changed in-flight.
		const channel = '/logging';

		let promises = [
			description(params).then(txt=>bolt.entityDecode(txt)),
			(config.property ? property(params) : Promise.resolve(params[0]))
				.then(txt=>bolt.entityDecode(txt))
		];

		Promise.all(promises).then(([description, property])=>{
			let message = {
				level,
				type: config.action || config.event,
				description,
				property,
				style: {
					property: {
						colour: config.propertyColour || 'yellow'
					},
					type: {
						colour: config.typeColour || 'green'
					},
					description: {
						colour: config.descriptionColour || 'white'
					}
				}
			};

			bolt.publish(channel, message);
		});
	});
}

/**
 * Setup logging both to the console and to the access logs.
 *
 * @private
 * @param {BoltApplication} app    The express application.
 */
function _initLogging(app) {
	app.config.eventConsoleLogging.forEach(config=>_registerLogEvent(config));
	_initConsoleLogging(app.config.logLevel, message=>{
		const pc = message.data.style.property.colour || 'yellow';
		const tc = ((message.data.style.type.colour || 'green') + 'Bright').replace('BrightBright', 'Bright');
		const mc = message.data.style.description.colour || 'white';

		const _message = `[${chalk[tc](message.data.type)}] ${chalk[mc].bold(message.data.description)} ${chalk[pc].italic(message.data.property)}`;
		console.log(_message)
	});
	_initAccessLogging(app.config.accessLog);

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
function _initAccessLogging(logPath) {
	if (logPath) {
		bolt.makeDirectory(path.dirname(logPath)).then(()=>bolt.fs.open(logPath, 'a').then(fd=>{
			bolt.subscribe('/logging/access', (options, message)=>bolt.fs.write(fd, message));
		}));
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
	const root = [...app.config.root, ...await getComponentDirectories(app.config.root)];
	const boltDirectories = (await bolt.directoriesInDirectory(root, ['bolt']))
		.filter(dirPath=>(dirPath !== boltRootDir + '/bolt'));

	await Promise.all(boltDirectories.map(dirPath=>{
		return require.import(dirPath, {
			merge: true,
			retry: true,
			imports: bolt,
			onload: async (target, exports)=>{
				const event = new bolt.BoltModuleReadyEvent({
					type: 'boltModuleReady',
					sync: false,
					target,
					exports,
					allowedZones: ['server'],
					unload: false
				});
				await bolt.emit('boltModuleReady', event);
				return !event.unload;
			},
			onerror: error=>{
				bolt.waitEmit('initialiseApp', 'boltModuleFail', error.source);
				console.error(error.error);
			}
		});
	}));

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
		.then(_initLogging)
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
	if (app.config.debug) bolt.MODE.add("DEBUG");
	if (app.config.development) bolt.MODE.add("DEVELOPMENT");
	if (app.config.production) bolt.MODE.add("PRODUCTION");
	bolt.LOGLEVEL = app.config.logLevel;
	bolt.VERSION = {
		lodash:bolt.VERSION,
		bolt:app.config.version
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
			config: {enumerable: true, configurable: false, value: config, writable: false},
			routers: {enumerable: true, configurable: false, value: {}, writable: false},
			controllerRoutes: {enumerable: true, configurable: false, value: {}, writable: true},
			shortcodes: {enumerable: true, configurable: false, value: {}, writable: false},
			templates: {enumerable: true, configurable: false, value: {}, writable: false},
			componentType: {enumerable: true, configurable: false, value: 'app', writable: false}
		});
	}
}

module.exports = {
	loadApplication, getApp, importIntoObject, BoltApplication
};
