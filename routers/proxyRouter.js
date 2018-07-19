'use strict';

const proxy = require('express-http-proxy');
const iconv = require('iconv-lite');

const defaultUploadLimit = 1024*1024; // 1Mb

/**
 * Test if content matches a type in a given array.
 *
 * @private
 * @param {string} type               Type to lookup.
 * @param {Array|string} matchType    Types to match against.
 * @returns {boolean}                 Is it a match?
 */
function contentIsType(type, matchType) {
	let matchTypes = bolt.makeArray(matchType);
	return ((type.filter(_type=>(matchTypes.indexOf(_type) !== -1))).length > 0);
}

/**
 * Get encoding in types array.
 *
 * @private
 * @param {Array} type                        The types array to search for encoding in.
 * @param {string} [defaultEncoding='utf-8']  The default encoding to return if encoding not found.
 * @returns {string}                          The encoding string.
 */
function getEncodingOfType(type, defaultEncoding='utf-8') {
	if (type.length <= 1) return defaultEncoding;
	let encodings = type
		.filter(type=>(type.indexOf('charset=') !== -1))
		.map(encoding=>encoding.split('=').pop());

	return (encodings.length ? encodings.shift() : defaultEncoding);
}

/**
 * Get content types.
 *
 * @private
 * @param {external:express:request} res      The response object.
 * @returns {Array}                           Content typesarray.
 */
function getTypesArray(res) {
	return (res.get('Content-Type') || '').split(';').map(type=>type.trim());
}

/**
 * Function to parse returned data for ejs.
 *
 * @private
 * @param {Object} options                    Ejs options.
 * @param {external:express:response} req     The request object.
 * @returns {Promise.<string>}                Parsed data.
 */
function parseReturnedData(options, req) {
	if (options.text.indexOf('<'+options.options.delimiter) === -1) return Promise.resolve(options.text);
	let template = bolt.compileTemplate(options);
	return Promise.resolve(template({}, req, {}));
}

/**
 * Parse ejs content where type is set for paring before sending back to user.
 *
 * @private
 * @param {Object} options    Options.
 * @returns {Object}          Promise resolving to options after content parsed (or not).
 */
function _ejsIntercept(options) {
	if (!contentIsType(options.type, options.proxyConfig.proxyParseForEjs)) return Promise.resolve(options);

	return parseReturnedData(options, options.req).then(text=>{
		options.text = text;
		return options;
	});
}

/**
 * Intercept handler.
 *
 * @private
 * @param {BoltApplication} app     The bolt application.
 * @param {Object} appProxyConfig   Proxy options.
 * @returns {Function}              The intercept function.
 */
function _initIntercept(app, proxyConfig) {
	return (rsp, data, req, res)=>{
		let type = getTypesArray(res);
		let interceptCount = 0;

		let options = {
			text:iconv.decode(data, getEncodingOfType(type)),
			data,
			sendText: true,
			filename:req.path,
			app,
			options:{},
			type,
			proxyConfig,
			rsp,
			res,
			req
		};

		if (proxyConfig.delimiter) options.options.delimiter = proxyConfig.delimiter;

		function interceptCaller(interceptCount) {
			return proxyConfig.intercepts[interceptCount](options).then(options=>{
				interceptCount++;
				if (interceptCount < proxyConfig.intercepts.length) return interceptCaller(interceptCount);
				return options;
			});
		}

		if (proxyConfig.intercepts && proxyConfig.intercepts.length) {
			return interceptCaller(interceptCount).then(options=>options.sendText?options.text:options.data);
		}

		return data;
	};
}

/**
 * Create and add a request path resolver function if one or mote is defined in the config.
 *
 * @private
 * @param {BoltApplication} app     The bolt application.
 * @param {Object} appProxyConfig   Proxy options.
 * @param {Object} config           Proxy config object.
 * @returns {Function}              The request path resolver function.
 */
function _initSlugger(app, appProxyConfig, config) {
	let _slugger = require.try(true, app.locals.root.map(root=>root+appProxyConfig.slugger)).then(slugger=>{
		config.proxyReqPathResolver = slugger(appProxyConfig);
		return config.proxyReqPathResolver;
	});

	return (req)=>{
		return _slugger.then(()=>config.proxyReqPathResolver(req));
	}
}

/**
 * Create and add an intercept function if one or more are defined in the config.
 *
 * @private
 * @param {BoltApplication} app     The bolt application.
 * @param {Object} appProxyConfig   Proxy options.
 * @param {Object} config           Proxy config object.
 * @returns {Promise.<Object>}      Promise resolving to mutated config object.
 */
function _initInterceptModule(app, appProxyConfig, config) {
	return bolt.require.try(true, app.locals.root.map(root=>root+appProxyConfig.intercept)).then(intercept=>{
		appProxyConfig.intercepts.push(intercept);
		return config;
	});
}

/**
 * Create a decorate body function.
 *
 * @private
 * @param {BoltApplication} app     The bolt application.
 * @param {Object} appProxyConfig   Proxy options.
 * @returns {Function}              The decorate body function.
 */
function _initBodyDecorateRequest(app, appProxyConfig) {
	return (bodyContent, srcReq)=>{
		if (bolt.isPlainObject(bodyContent)) {
			return bolt.objectToQueryString(bodyContent, {
				addEquals: appProxyConfig.addEqualsToEmptyQueryValues || false
			});
		}
		return bodyContent;
	};
}

/**
 * Create a decorate request function.
 *
 * @private
 * @param {BoltApplication} app     The bolt application.
 * @param {Object} appProxyConfig   Proxy options.
 * @returns {Function}              Decorate request function.
 */
function _initOptDecorateRequest(app, appProxyConfig) {
	return (proxyReqOpts, srcReq)=>{
		if (appProxyConfig.host) proxyReqOpts.headers.host = appProxyConfig.host;
		return proxyReqOpts;
	};
}

/**
 *
 * @private
 * @param {BoltApplication} app     The bolt application to apply router to.
 * @param appProxyConfig            Proxy options.
 * @returns {*}
 */
function _proxyRouter(app, appProxyConfig) {
	const limit = (bolt.isObject(app.locals.uploadLimit) ?
		app.locals.uploadLimit.proxy || defaultUploadLimit :
		app.locals.uploadLimit || defaultUploadLimit
	);

	let config = {
		reqAsBuffer: true,
		reqBodyEncoding: null,
		proxyReqOptDecorator: _initOptDecorateRequest(app, appProxyConfig),
		proxyReqBodyDecorator: _initBodyDecorateRequest(app, appProxyConfig),
		userResDecorator: _initIntercept(app, appProxyConfig),
		limit
	};

	appProxyConfig.intercepts = bolt.makeArray(appProxyConfig.intercepts || []);

	if (appProxyConfig.proxyParseForEjs) config.intercepts = appProxyConfig.intercepts.push(_ejsIntercept);
	if (appProxyConfig.slugger) config.proxyReqPathResolver = _initSlugger(app, appProxyConfig, config);
	if (appProxyConfig.intercept) _initInterceptModule(app, appProxyConfig, config);

	return proxy(appProxyConfig.forwardPath, config);
}

/**
 * The proxy router.  Router,which can use bolt as a proxy server.
 *
 * @public
 * @param {BoltApplication} app     The bolt application to apply router to.
 * @returns {Object}                The router object.
 */
function proxyRouter(app) {
	// @annotation priority -10

	let routing = [(req, res, next)=>next()];
	if (app.locals.proxy && app.locals.proxy.forwardPath) {
		bolt.makeArray(app.locals.proxy).forEach(proxyConfig=>{
			if (proxyConfig.forwardPath) routing.push(_proxyRouter(app, proxyConfig));
		});
	}
	return routing;
}

module.exports = proxyRouter;
