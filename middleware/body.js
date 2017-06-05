'use strict';

const bodyParser = require('body-parser');


function isMultipartRequest(req) {
  const contentTypeHeader = req.headers['content-type'];
  return (contentTypeHeader && (contentTypeHeader.indexOf('multipart') > -1));
}

function init(app) {
  const jsonParser = bodyParser.json();
  const urlParser = bodyParser.urlencoded({extended:true});
  const textParser = bodyParser.text();
  const rawParser = bodyParser.raw();

  app.use(
    (req, res, next)=>(isMultipartRequest(req) ? next() : urlParser(req, res, next)),
    (req, res, next)=>(isMultipartRequest(req) ? next() : jsonParser(req, res, next)),
    (req, res, next)=>(isMultipartRequest(req) ? next() : textParser(req, res, next)),
    (req, res, next)=>(isMultipartRequest(req) ? next() : rawParser(req, res, next))
  );
};

init.priority = 2;
module.exports = init;
