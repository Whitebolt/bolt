'use strict';
// @annotation zone server

const mime = require('mime');

const _componentAllowedToSet = [
	'done', 'status', 'stausMessage', 'header', 'mime'
];

const xCsvReplaceSeq = [[/\\/g, '\\'], [/\r\n/g, `\n`], [/\n/g,'\\n'], [/"/g, '\"']];

/**
 * Get all possible paths for given express request object in order.  Routes cascade so /test1/test2/test3 can fire
 * component controllers for /test1/test2/test3, /test1/test2 and /test1.
 *
 * @private
 * @param {Object} req          Express request object.
 * @returns {Array.<string>}    Possible routes in cascading order.
 */
function _getPaths(req) {
	let lopper = bolt.lopGen(bolt.getPathFromRequest(req));
	let lookup = new Set();
	return function* () {
		for (const route of lopper()) {
			lookup.add(route);
			yield route;
		}
		if (!lookup.has('/')) yield '/';
	};
}

/**
 * Apply current route, sending data back to client.
 *
 * @public
 * @param {Object} router   Router object.
 * @returns {*}
 */
function applyAndSend(router) {
	const {req, res} = router;
	const status = router.status || res.statusCode || 200;
	const statusMessage = router.statusMessage || res.statusMessage;

	function send(content={}) {
		let data;
		if (router.sendFields) {
			data = bolt.pick(req.doc, bolt.makeArray(router.sendFields));
			if (content && (bolt.isObject(content)?Object.keys(content).length:true)) Object.assign(data, {content});
		} else {
			data = content;
		}

		if (router.redirect) data.redirect = router.redirect;

		return res
			.status(status)
			.send((data === null) ? null : data || statusMessage)
			.end();
	}

	if (bolt.get(req, 'doc.data', false) && (bolt.get(req, 'doc._responseMimeType') === 'text/csv')) {
		return sendCsv(req, res, send);
	} else if (router.template) {
		return req.app.applyTemplate(router, req).then(send);
	} else if (router.sendFields) {
		return send();
	} else if (status === 204) {
		return send(null);
	} else if (statusMessage !== "") {
		return send();
	}
}

function sendCsv(req, res, send) {
	const filename = bolt.get(req, 'doc._responseAttachmentName');

	res.type("csv");
	if (filename) res.attachment(filename);

	const data = bolt.get(req, "doc.data", [[]]).map(
		row=>`"`+row.map(field=>bolt.replaceSequence(bolt.toString(field), xCsvReplaceSeq)).join(`","`)+`"`
	).join(`\n`);

	return send(data);
}

/**
 * Set the bound object.  Function is meant to be bound to a component object passed to routers.
 *
 * @public
 * @param {string} mimeType   Mimetype to use.
 * @private
 */
function setMime(mimeType) {
	this.res.set('Content-Type', mime.getType(mimeType));
}

/**
 * Set method assigned to component object passed to controller methods. Method can be used to set headers in the
 * server responses.
 *
 * @public
 * @param {string|object} values    The value name to set or object of key/value pairs to set.
 * @param {*} [value]               Value to set or header property name if setting a header value.
 * @param {*} [headerValue]         If values is set to header then this is the value to use for header.
 * @private
 */
function componentSet(values, value, headerValue) {
	if (value !== undefined) {
		if (values === 'header') {
			this.res.set(value, headerValue);
		} else if (values === 'mime') {
			this.res.set('Content-Type', mime.getType(value));
		} else {
			this[values] = value;
		}
	} else {
		_componentAllowedToSet.forEach(key=>{
			if (values.hasOwnProperty(key)) {
				if (key === 'header') {
					Object.keys(values[key] || {}).forEach(header=>
						this.res.set(header, values[key][header])
					);
				} else if (key === 'mime') {
					this.res.set('Content-Type', mime.getType(values[key]));
				} else {
					this[key] = values[key];
				}
			}
		});
	}
}

/**
 * Create the router object, which is passed around route methods.
 *
 * @public
 * @param {Object} req        Express request object.
 * @param {Object} res        Express response object.
 * @param {Object} [socket]   Socket.io object if this is a socket.io route.
 * @returns {Object}          Router object
 */
function createRouterObject(req, res, socket) {
	let router = bolt.addTemplateFunctions({req, res, done:false});
	router.set = componentSet.bind(router);
	router.mime = setMime.bind(router);

	return router;
}

/**
 * Get an array of methods (in order) to fire for a give request path.
 *
 * @public
 * @param {Object} app          Express application object the request relates to.
 * @param {Object} req          The express request object.
 * @returns {Array.<Function>}  Methods that are applicable to request route.
 */
function getMethods(app, req, filter) {
	const methods = [];
	const cascading = new Map();
	const pathGen = _getPaths(req);


	for (let route of pathGen()) {
		if (app.controllerRoutes.hasOwnProperty(route)) {
			for (let n=0; n<app.controllerRoutes[route].length; n++) {
				const method = app.controllerRoutes[route][n];

				let methodPath = bolt.annotation.get(method.method, 'methodPath');
				let add = true;

				if (!cascading.has(methodPath)) {
					cascading.set(methodPath, !!bolt.annotation.get(method.method, 'cascade'));
				} else {
					add = cascading.get(methodPath);
				}

				if (filter) add = !!filter(method.method, bolt.annotation.get(method.method, 'sourceMethod'));
				let visibility = bolt.annotation.get(method.method, 'visibility') || 'public';
				if (visibility !== 'public') add = false;

				if (add) {
					methods.push(router=>{
						router.__componentName = router.component || bolt.annotation.get(method.method, 'componentName');
						router.componentPath = bolt.annotation.get(method.method, 'componentPath');
						return method.method(router);
					});
				}
			}
		}
	}
	return methods;
}

module.exports = {
	boltRouter: {
		getMethods, createRouterObject, applyAndSend
	}
};