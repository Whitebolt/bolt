'use strict';

const bodyParser = require('body-parser');


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

/**
 * Parse the body property of request. Parses json, url, text and raw data.
 *
 * @public
 * @param {BoltApplication} app   The bolt application instance.
 */
function init(app) {
  // @annotation priority 2

  const jsonParser = bodyParser.json();
  const urlParser = bodyParser.urlencoded({extended:true});
  const textParser = bodyParser.text();
  const rawParser = bodyParser.raw();

  app.use(
    (req, res, next)=>((_isMultipartRequest(req) || _isWebsocket(req))? next() : urlParser(req, res, next)),
    (req, res, next)=>((_isMultipartRequest(req) || _isWebsocket(req))? next() : jsonParser(req, res, next)),
    (req, res, next)=>((_isMultipartRequest(req) || _isWebsocket(req))? next() : textParser(req, res, next)),
    (req, res, next)=>((_isMultipartRequest(req) || _isWebsocket(req))? next() : rawParser(req, res, next))
  );
};

module.exports = init;
