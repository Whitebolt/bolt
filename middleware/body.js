'use strict';

const bodyParser = require('body-parser');

const defaultUploadLimit = 1024*1024; // 1Mb
const defaultUploadLimits = {
	json: 1024*100, // 100k
	text: 1024*100, // 100k
	raw: defaultUploadLimit,
	url: defaultUploadLimit
};


/**
 * Test if given request is multipart-mime.
 *
 * @private
 * @param {external:express:request} req    The request to test on.
 * @returns {boolean}                       Is it mulipart or not?
 */
function _isMultipartRequest(req) {
	const contentTypeHeader = req.headers['content-type'];
	return (contentTypeHeader && (contentTypeHeader.indexOf('multipart') > -1));
}

function _isWebsocket(req) {
	return !!req.websocket;
}

function getUploadLimit(app) {
	const uploadLimit = app.config.uploadLimit || 102400;
	if (bolt.isObject(uploadLimit)) return Object.assign({
		json: defaultUploadLimit,
		text: defaultUploadLimit,
		raw: defaultUploadLimit,
		url: defaultUploadLimit
	}, defaultUploadLimits, uploadLimit);
}

/**
 * Parse the body property of request. Parses json, url, text and raw data.
 *
 * @public
 * @param {BoltApplication} app   The bolt application instance.
 */
function init(app) {
	// @annotation priority 3

	const jsonParser = bodyParser.json();
	const urlParser = bodyParser.urlencoded({
		limit: app.config.uploadLimit || 102400,
		extended:true
	});
	const textParser = bodyParser.text();
	const rawParser = bodyParser.raw({
		type: req=>(req.is('application/octet-stream') || req.is('binary/bmf')),
		limit: app.config.uploadLimit || 102400
	});

	function skip(req, res, next, parser) {
		return ((_isMultipartRequest(req) || _isWebsocket(req)) ? next() : parser(req, res, next));
	}

	app.use(
		(req, res, next)=>skip(req, res, next, urlParser),
		(req, res, next)=>skip(req, res, next, jsonParser),
		(req, res, next)=>skip(req, res, next, textParser),
		(req, res, next)=>skip(req, res, next, rawParser)
	);
}

module.exports = init;
