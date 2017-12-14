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

const { r, g, b, w, c, m, y, k } = [
  ['r', 1], ['g', 2], ['b', 4], ['w', 7],
  ['c', 6], ['m', 5], ['y', 3], ['k', 0]
].reduce((cols, col) => ({...cols,  [col[0]]: f => `\x1b[3${col[1]}m${f}\x1b[0m`}), {});

const colourLookup = {
  red:r, green:g, blue:b, white:w, cyan:c, magenta:m, yellow:y
};

function colour(name, text) {
  return text?colourLookup[name](text):colourLookup[name];
}

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
      description(params),
      config.property ? property(params) : Promise.resolve(params[0])
    ];

    Promise.all(promises).spread((description, property) => {
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
    const pc = colour(message.data.style.property.colour || 'yellow');
    const tc = colour(message.data.style.type.colour || 'green');
    const mc = colour(message.data.style.description.colour || 'white');

    const _message = `[${tc(message.data.type)}] ${mc(message.data.description)} ${pc(message.data.property)}`;
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
    bolt.makeDirectory(path.dirname(logPath)).then(()=>open(logPath, 'a').then(fd=>{
      bolt.subscribe('/logging/access', (options, message)=>write(fd, message));
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
      imports: bolt,
      onload:(modulePath, exports)=>{
        bolt.boltOnLoad(modulePath, exports);
        return bolt.emit('extraBoltModuleLoaded', modulePath);
      }
    });
  }));

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
function importIntoObject(options) {
  return Promise.all(bolt.directoriesInDirectory(options.roots, [options.dirName])
    .mapSeries(dirPath => {
      return require.import(dirPath, {
        imports: options.importObj || {},
        onload: filepath=>bolt.emit(options.eventName, filepath),
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
  await bolt.emitBefore('initialiseApp');
  const app = await _loadApplication(configPath);
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
