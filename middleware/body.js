'use strict';

const bodyParser = require('body-parser');
//const BMF = require('binary-message-format/lib');


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

function bmfParser(req, res, next) {
	if (req.is('binary/bmf')) {
		const view = new Uint8Array(req.body, req.body.byteOffset, req.body.byteLength);
		const message = new BMF(view);

		let body = {};

		message.headers.forEach((value, header)=>{
			body[header] = value;
		});
		body.frames = [...message.frames].map(frameRaw=>{
			let frame = {};
			frameRaw.headers.forEach((value, header)=>{
				frame[header] = value;
			});
			frame.body = frameRaw.parsedBody;
			return frame;
		});

		req.body = body;
	}

	next();
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
		limit: app.config.uploadLimit || '1M',
		extended:true
	});
	const textParser = bodyParser.text();
	const rawParser = bodyParser.raw({
		type: req=>(req.is('application/octet-stream') || req.is('binary/bmf')),
		limit: app.config.uploadLimit || '1M'
	});

	function skip(req, res, next, parser) {
		return ((_isMultipartRequest(req) || _isWebsocket(req)) ? next() : parser(req, res, next));
	}

	function bmfParser(req, res, next) {
		next();
	}

	app.use(
		(req, res, next)=>skip(req, res, next, urlParser),
		(req, res, next)=>skip(req, res, next, jsonParser),
		(req, res, next)=>skip(req, res, next, textParser),
		(req, res, next)=>skip(req, res, next, rawParser)/*,
		 (req, res, next)=>skip(req, res, next, bmfParser)*/
	);
}

module.exports = init;
