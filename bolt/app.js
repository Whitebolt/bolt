'use strict';

/**
 * @module bolt/bolt
 */

const Promise = require('bluebird');
const fs = require('fs');
const open = Promise.promisify(fs.open);
const write = Promise.promisify(fs.write);
const ejs = require('ejs');
const path = require('path');

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

  return bolt.on(config.event, (options, ...params) => {
    let level = config.level || 3; // Placed here so level can be changed in-flight.
    let channel = _getEventChannel('logging', level, 8);
    let promises = [
      description(params),
      config.property ? property(params) : Promise.resolve(params[0])
    ];

    Promise.all(promises).spread((description, property) => {
      let message = '[' + colour[config.actionColour || 'green'](' ' + (config.action || config.event) + ' ') + '] ' + description + ' ' + colour[config.propertyColour || 'yellow'](property);
      bolt.broadcast(channel, message);
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
  app.config.eventConsoleLogging.forEach(config => _registerLogEvent(config));
  _initConsoleLogging(app.config.logLevel, (options, message) => console.log(message));
  _initAccessLogging(app.config.accessLog);

  return app;
}

/**
 * Initalise console logging for given log level.
 *
 * @private
 * @param {integer} level       Log level to subscribe to.
 * @param {function} callback   Callback to fire on event.
 */
function _initConsoleLogging(level, callback) {
  let channel = _getEventChannel('logging', level, 8);
  bolt.subscribe(channel, callback);
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
    bolt.makeDirectory(path.dirname(logPath)).then(()=>open(logPath, 'a').then(fd=>{
      bolt.subscribe('/logging/access', (options, message)=>write(fd, message));
    }));
  }
}

/**
 * Get a logging channel based on a level.  So with a root of 'logging' and
 * level of 6 (max 8), the channel would be /logging/8/7/6.  With the same
 * root and max but a level of 3, the channel would be /logging/8/7/6/5/4/3
 *
 * @private
 * @param {string} root     The root channel name.
 * @param {integer} level   The level to use.
 * @param {integer} max     The max level possible.
 * @returns {string}        The channel name.
 */
function _getEventChannel(root, level, max) {
  let channel = '/' + root;
  for (let n=max; n>=level; n--) channel += '/' + n.toString();
  return channel;
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

  await Promise.all(boltDirectories.map(dirPath=>require.import(dirPath, {
    merge: true,
    imports: bolt,
    onload:(filePath)=>bolt.fire('extraBoltModuleLoaded', filePath)
  })));

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
      bolt.fire('configLoaded', configPath);
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
function importIntoObject(options) {
  return Promise.all(bolt.directoriesInDirectory(options.roots, [options.dirName])
    .mapSeries(dirPath => {
      return require.import(dirPath, {
        imports: options.importObj || {},
        onload: filepath=>bolt.fire(options.eventName, filepath),
        basedir: boltRootDir,
        parent: __filename
      });
    })
  );
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
  return await bolt.fire(()=>_loadApplication(configPath), 'initialiseApp', configPath);
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
