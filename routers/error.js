'use strict';


/**
 * Handle any errors.
 *
 * @param {Error} error     Error object to handle.
 * @param {Object} config   Route config object.
 */
function handleMethodErrors(error, config) {
	console.error(error);
	config.next();
}

/**
 * Call the next method or run applyAndSend if done.
 *
 * @param {Object} config       Router config object.
 * @returns {Promise}           Promise resolving when data has been sent back to user.
 */
async function callMethod(config) {
	const method = bolt.makePromise(config.methods.shift());
	const {router} = config;
	const {res} = router;

	try {
		await method(router);
	} catch (err) {
		return handleMethodErrors(err, config)
	}

	if (router.done && !res.headersSent) return bolt.boltRouter.applyAndSend(router);
	if (!config.methods.length || !!router.done || !!res.headersSent) return router;

	return callMethod(config);
}

function getErrorReqObject(req, res) {
	const path = '/error/' + res.statusCode;
	return new Proxy(req, {
		get(target, property) {
			if (property === 'path') return path;
			return target[property];
		}
	});
}

/**
 * The bolt router. This will fire return a router function that fires components, controllers and methods according
 * to the bolt routing rules.
 *
 * @private
 * @param {bolt:application} app    Express application object.
 * @returns {Function}              Express router function.
 */
function _httpRouter(app) {
	return (_req, res, next)=> {
		if (_req.statusCode < 400) return next();

		const req = getErrorReqObject(_req, res);
		const methods = bolt.boltRouter.getMethods(
			app, req, method=>!!bolt.annotation.get(method, 'accept-errors')
		);
		const router = bolt.boltRouter.createRouterObject(req, res);
		router.res.statusMessage = router.res.body;

		if (!methods.length) next();
		callMethod({methods, router, next}).then(router=> {
			if (router && router.res && !router.res.headersSent) next();
		});
	};
}


/**
 * The bolt router. This will fire return a router function that fires components, controllers and methods according
 * to the bolt routing rules. Routing is mimicked as closely as possible in socket.io so routing can transparent
 * for either ajax or websocket.
 *
 * @public
 * @param {bolt:application} app    Express application object.
 * @returns {Function}              Express router function.
 */
function errorRouter(app) {
	// @annotation priority 9999999

	return _httpRouter(app);
}

module.exports = errorRouter;
