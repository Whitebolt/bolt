'use strict';
// @annotation zone manager

/**
 * @module bolt/bolt
 * @todo Add windows and mac path?
 */

const promisify = require('util').promisify || Promise.promisify;
const freeport = promisify(require('find-free-port'));
const path = require('path');

const packageData = _getPackage(boltRootDir);
const packageConfig = packageData.config || {};
const env = getKeyedEnvVars();


/**
 * Parse the environment variable value into arrays and types (float,
 * integer and boolean).
 *
 * @private
 * @param {string} value    Value to parse.
 * @returns {Array|*}       Parsed value.
 */
function _parseEnvValue(value) {
	[_parseEnvArray, bolt.toBool, bolt.toTypedNumber].forEach(converter=>{
		value = _parseEnvValueConvert(value, converter);
	});

	return value;
}

/**
 * Take an environment variable string and convert arrays into arrays,.
 *
 * @private
 * @param {string} value      Value to convert.
 * @returns {string|array}    New array or original string.
 */
function _parseEnvArray(value) {
	return (value.indexOf(path.delimiter) !== -1 ?
			value.split(path.delimiter).map(value=>value.trim()) :
			value
	);
}

/**
 * Convert given environment variable using the given convertor function. Will accept arrays, converting each item.
 *
 * @private
 * @param {Array|*} value         Value to convert.
 * @param {Function} converter    Converter function.
 * @returns {*}                   Converted value.
 */
function _parseEnvValueConvert(value, converter) {
	return (Array.isArray(value) ? value.map(value=>_parseEnvValueConvertItem(value, converter)) : _parseEnvValueConvertItem(value, converter));
}

/**
 * Convert given environment variable using the given converter function. Will not accept arrays.
 *
 * @private
 * @param {*} value               Value to convert.
 * @param {Function} converter    Converter function.
 * @returns {*}                   Converted value.
 */
function _parseEnvValueConvertItem(value, converter) {
	let converted = converter(value);
	return ((converted !== value) ? converted :value);
}


/**
 * Parse config, parsing templated values and return the config.
 *
 * @private
 * @param {BoltConfig} config   Initial config.
 * @returns {BoltConfig}        The parsed config.
 */
async function _parseConfig(config) {
	config.script = boltRootDir + '/server.js';
	const dbConfig = bolt.substituteInObject(config);
	const root = await getRoots(dbConfig, env, packageConfig);

	const _config = bolt.mergeWith(_getConfig({root}), env, dbConfig, _configMerger);
	_config.root = root;
	return bolt.substituteInObject(_config);
}

async function getRoots(...configs) {
	const roots = await Promise.all(_concatPropertyArray(configs, 'root')
		.filter(root=>root)
		.map(async (root)=>{
			try {
				const _root = await bolt.fs.realpath(path.normalize(root));
				return `${_root}${path.sep}`;
			} catch(err) {

			}
		})
		.value()
	);

	return roots.filter(root=>root);
}

/**
 * Take an array of objects and return the given property from (assuming an array) and merge together.
 *
 * @private
 * @param {BoltConfig[]} objects    Objects to get property from.
 * @param {string} property         Property to get.
 * @returns {BoltConfig[]}          Merged array.
 */
function _concatPropertyArray(objects, property) {
	return bolt.chain(objects)
		.map(_property=>_property[property] || [])
		.flatten()
		.uniq();
}

/**
 * Assign a new port according to config options.
 *
 * @private
 * @param {BoltConfig} config   The config object.
 * @returns {BoltConfig}      The config with port assigned.
 */
function _assignPort(config) {
	if (config.assignFreePort && config.portRange && config.portRange.start && config.portRange.end) {
		return freeport(config.portRange.start, config.portRange.end).then(portNo=>{
			config.devPort = config.port;
			config.port = portNo;
			return config;
		})
	}

	return config;
}

/**
 * Join two arrays together, filtering-out duplicates
 *
 * @private
 * @param ary1        First array.
 * @param ary2        Second Array.
 * @returns {Array}   Merged array of unique values.
 */
function _concatArrayUnique(ary1, ary2) {
	let combined = [].concat(ary1 || []).concat(ary2 || []);
	return [...new Set(combined)];
}

const _configMergeOverrides = {
	modules: (objValue, srcValue)=>_concatArrayUnique(objValue, srcValue),
	questions: (objValue, srcValue)=>[...bolt.makeArray(srcValue), ...bolt.makeArray(objValue)],
	nodeModulesServe: (objValue, srcValue, key, object, source)=>{
		return {...objValue, [source.__packagePath]:srcValue};
	},

	/**
	 * Merge eventConsoleLogging arrays together avoid duplicates and merging of
	 * the actual objects (default lodash action).
	 *
	 * @param {Array} objValue    The value being merged into.
	 * @param {Array} srcValue    The value to merge in.
	 * @returns {Array}           The merged value.
	 */
	eventConsoleLogging: (objValue, srcValue)=>_concatArrayUnique(objValue, srcValue)
};

/**
 * Generate a function to to merge the configs together. The default lodash
 * merge is used, unless an override is supplied via _configMergeOverrides.
 *
 * @private
 * @param {*} objValue    The value being merged into.
 * @param {*} srcValue    The value to merge in.
 * @param {string} key    The object property we are merging.
 * @returns {undefined|*} The new value after merging or undefined to use
 *                        default method.
 */
function _configMerger(objValue, srcValue, key, object, source, stack) {
	return (_configMergeOverrides.hasOwnProperty(key) ?
			_configMergeOverrides[key](objValue, srcValue, key, object, source, stack) :
			undefined
	);
}

/**
 * Get a config object from package.json and the supplied config.
 *
 * @private
 * @param {BoltConfig} config   Config object to act as the last merge item.
 * @returns {BoltConfig}        The new constructed config with default available.
 */
function _getConfig(config) {
	let packageConfigs = [];
	let _packageConfigs = mergePackageConfigs(config.root);
	packageConfigs.push(bolt.pickDeep(packageData, ['version', 'name', 'description']));
	packageConfigs.push({template:'index', serverName: packageData.name});
	packageConfigs.push(packageData.config);
	packageConfigs.push(_packageConfigs);

	const modules = [];
	bolt.makeArray(config.root).forEach(root=>{
		const {name, version} = bolt.pick(getPackage(root), ["name", "version"]);
		if (name && version) modules.push({name, version});
	});
	packageConfigs.push({modules});

	return bolt.mergeWith.apply(bolt, packageConfigs);
}

/**
 * @typedef BoltConfig
 * Configuration object for bolt-server.
 *
 * @property {integer} [port]                       Network port to attach app to.
 * @property {string|Array} root                    The directory roots to load server from.
 * @property {string} accessLog                     Location to write access log to.
 * @property {string|Array.<string>} [template]     Named template(s) to apply.
 * @property {Array.<BoltConfigDb>} [databases]     Databases to load.
 * @property {string} secret                        Cookie encryption string.
 * @property {boolean} [development]                Run in development mode or not?
 * @property {Array.<Object>} [proxy]               Define any proxies.
 * @property {Array.<Object>} [eventConsoleLogging] Event logging options.
 * @property {integer} [logLevel]                   Log level to run at (0-8).
 */

/**
 * @typedef BoltConfigDb
 * @property {string} type                    Connection type (eg. mongodb,
 *                                            mysql, ...etc).
 * @property {string} [server='localhost']    Server hostname
 * @property {integer} [port]                 Port no.
 * @property {string} database                Database name.
 * @property {string} [username]              Username to connect as.
 * @property {string} [password]              Password to use.
 * @property {string} [adminDatabase='admin'] Admin database to use (mongo specfic).
 */

/**
 * Load config from default locations.
 *
 * @private
 * @returns {BoltConfig}    The config object.
 */
function getConfigLoadPaths(serverConfigFile = (env.serverConfigFile || packageConfig.serverConfigFile)) {
	const configLoadPaths = [boltRootDir + '/' + serverConfigFile];
	if (env.hasOwnProperty('config')) bolt.makeArray(env.config).forEach(config=>configLoadPaths.push(config + '/' + serverConfigFile));
	if (packageConfig.serverConfigPath) configLoadPaths.push(packageConfig.serverConfigPath + '/' + serverConfigFile);
	return bolt.flattenDeep(configLoadPaths);
}

/**
 * Get the package file in the given directory (or return empty object).
 *
 * @private
 * @param {string} dirPath    Path to load from.
 * @returns {BoltConfig}          The package object.
 */
function getPackage(dirPath=boltRootDir, eventName) {
	const pkgPath = path.join(dirPath, 'package.json');
	try {
		const pkg = require(pkgPath);
		if (eventName) bolt.chain(eventName.split(','))
			.map(eventName=>eventName.trim())
			.filter(eventName=>eventName)
			.forEach(eventName=>bolt.waitEmit('initialiseApp', eventName, pkgPath))
			.value();
		return pkg;
	} catch(err) {
		return {};
	}
}

function _getPackage(dirPath=boltRootDir) {
	const data = getPackage(dirPath, 'configFileLoaded');
	if (Object.keys(data).length && data.hasOwnProperty('name')) data[bolt.camelCase(data.name)+'Path'] = dirPath;
	bolt.set(data, 'config.__packagePath', dirPath);
	return data;
}

/**
 * Grab package.json files and get the specfied properties merging them all together.
 *
 * @public
 * @param {string[]|string} roots              The directories to load from.
 * @param {Array|string} [properties=[]]        Properties to grab.
 * @param {Function} [merger=()=>{}]            Merger function to use.
 * @returns {Object}                            Merged object with selected properties.
 */
function mergePackageProperties(roots, properties=[], merger=()=>{}) {
	const packageConfigs = bolt.makeArray(roots).map(
		root=>bolt.pickDeep(_getPackage(root), bolt.makeArray(properties))
	);
	packageConfigs.unshift({});
	if (bolt.isFunction(merger)) packageConfigs.push(_configMerger);
	return bolt.mergeWith.apply(bolt, packageConfigs);
}

/**
 * Get configs items from environment variables (BOLT_*).
 *
 * @public
 * @param {string} [key='BOLT']       The key values to import.
 * @param {Object} [env=process.env]  The environment object to use.
 * @returns {Object}                  The imported values.
 */
function getKeyedEnvVars(key=packageConfig.boltEnvPrefix || 'BOLT', env=process.env) {
	let vars = {};
	bolt.chain(env)
		.keys()
		.filter(envKey=>envKey.toLowerCase().startsWith(key.toLowerCase()+'_'))
		.forEach(envKey=>{
			let varKey = bolt.camelCase(envKey.substr(key.length));
			vars[varKey] = _parseEnvValue(env[envKey]);
		})
		.value();

	return vars;
}

/**
 * Grab package.json files and get the config properties merging them all together.
 *
 * @public
 * @param {string[]|string} roots             The directories to load from.
 * @param {Function|string} [merger=()=>{}]   Merger function to use or configProp (if a string).
 * @param {string} [configProp='config]       The property to get from.
 * @returns {Object}                          The merged package.
 */
function mergePackageConfigs(roots, merger=_configMerger, configProp='config') {
	let _configProp = bolt.isString(merger)?merger:configProp;
	let _merger = bolt.isFunction(merger)?merger:()=>{};
	return bolt.get(mergePackageProperties(roots, _configProp, _merger), _configProp) || {};
}

async function _setSslCerts(config) {
	['key','csr','crt'].map(async (type)=>{
		const id = bolt.camelCase(`ssl-server-${type}`);
		const path = `${boltRootDir}/server.${type}`;
		if (!config[id] && await bolt.fileExists(path)) config[id] = `${boltRootDir}/server.${type}`;
	});
}

async function _loadAppConfig(name, filePaths) {
	const searchPaths = getConfigLoadPaths(`settings/apps/${name}.json`);
	const config = await require.try(true, [...searchPaths]);
	if (!config) {
		console.error(`No configurations found for app: ${name}, using the search path:\n\t${searchPaths.join('\n\t')}`);
		process.exit(9);
	}
	bolt.waitEmit('initialiseApp', 'configFileLoaded', filePaths.get(config));
	return _parseConfig(config);
}

async function _loadProfileConfig(name, appConfig, filePaths) {
	const searchPaths = getConfigLoadPaths(`settings/profiles/${name}.json`);
	const config = await require.try(true, [...searchPaths]);
	if (!!config) {
		bolt.waitEmit('initialiseApp', 'configFileLoaded', filePaths.get(config));
		return _parseConfig(config);
	}

	const defaultProfile = (appConfig.development ? 'development' : 'production');
	const defaultSearchPaths = getConfigLoadPaths(`settings/profiles/${defaultProfile}.json`);
	console.warn(`No configurations found for profile: ${name}, using the search path:\n\t${searchPaths.join('\n\t')}\nWill use default of '${defaultProfile}'.`);
	const defaultConfig = await require.try(defaultSearchPaths);
	if (!defaultConfig) {
		console.error(`No configurations found for default profile: ${name}, using the search path:\n\t${defaultSearchPaths.join('\n\t')}`);
		process.exit(9);
	}
	bolt.waitEmit('initialiseApp', 'configFileLoaded', filePaths.get(defaultConfig));
	return _parseConfig(defaultConfig);
}

/**
 * Load global config for app.
 *
 * @public
 * @static
 * @param {string} name           The config to load.
 * @returns {Promise<boltConfig>} Promise resolving to the config object.
 */
async function loadConfig(name, profile) {
	const filePaths = require.getStore('filePaths');
	const appConfig = await _loadAppConfig(name, filePaths);
	const profileConfig = await _loadProfileConfig(profile, appConfig, filePaths);

	if (!!profileConfig) {
		delete profileConfig.name;
		bolt.mergeWith(appConfig, profileConfig, _configMerger);
	}

	await _setSslCerts(appConfig);
	await _assignPort(appConfig);

	appConfig.development = (appConfig.hasOwnProperty('development') ? appConfig.development : false);
	appConfig.debug = (appConfig.hasOwnProperty('debug') ? appConfig.debug : false);
	if (bolt.fire) await bolt.emit('configLoaded', appConfig);
	if (appConfig.debug && !appConfig.production) process.kill(process.pid, 'SIGUSR1');
	bolt.__paths = new Set([...appConfig.root]);

	return appConfig;
}

module.exports = {
	loadConfig,
	getKeyedEnvVars,
	mergePackageConfigs,
	mergePackageProperties,
	getConfigLoadPaths,
	getPackage
};
