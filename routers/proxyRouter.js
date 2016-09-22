'use strict';

const Promise = require('bluebird');
const proxy = require('express-http-proxy');
const ejs = require('ejs');
const iconv = require('iconv-lite');


function contentIsType(type, matchType) {
  let matchTypes = bolt.makeArray(matchType);
  return ((type.filter(_type=>(bolt.indexOf(matchTypes, _type) !== -1))).length > 0);
}

function getEncodingOfType(type, defaultEncoding='utf-8') {
  if (type.length <= 1) return defaultEncoding;
  let encodings = type
    .filter(type=>(type.indexOf('charset=') !== -1))
    .map(encoding=>encoding.split('=').pop());

  return (encodings.length ? encodings.shift() : defaultEncoding);
}

function getTypesArray(res) {
  return (res.get('Content-Type') || '').split(';').map(type=>type.trim());
}


function _proxyRouter(app, proxyConfig) {
  let config = {
    reqAsBuffer: false
  };

  if (proxyConfig.proxyParseForEjs) {
    config.intercept = (rsp, data, req, res, callback)=>{
      let type = getTypesArray(res);
      if (contentIsType(type, proxyConfig.proxyParseForEjs)) {
        let _data = iconv.decode(data, getEncodingOfType(type));
        let options = {text:_data, filename:req.path, app};
        if (proxyConfig.delimiter) {
          options.options = options.options || {};
          options.options.delimiter = proxyConfig.delimiter;
        }
        let template = bolt.compileTemplate(options);
        Promise.resolve(template({}, req, {})).then(data=>callback(null, data));
      } else {
        callback(null, data);
      }
    };
  }
  if (proxyConfig.slugger) {
    let _slugger = bolt.require.getModule(app.config.root.map(root=>root+proxyConfig.slugger)).then(slugger=>{
      config.forwardPathAsync = slugger(proxyConfig);
      return config.forwardPathAsync;
    });
    config.forwardPathAsync = (req)=>_slugger.then(()=>config.forwardPathAsync(req));
  }

  config.decorateRequest = (proxyReq, req)=>{
    if (bolt.isPlainObject(proxyReq.bodyContent)) proxyReq.bodyContent = bolt.objectToQueryString(proxyReq.bodyContent);
    if (proxyConfig.host) proxyReq.headers.host = proxyConfig.host;
    return proxyReq;
  };

  return proxy(proxyConfig.forwardPath, config);
}

function proxyRouter(app) {
  let routing = [(req, res, next)=>next()];
  if (app.config.proxy && app.config.proxy.forwardPath) {
    bolt.makeArray(app.config.proxy).forEach(proxyConfig=>{
      if (proxyConfig.forwardPath) routing.push(_proxyRouter(app, proxyConfig));
    });
  }
  return routing;
}

proxyRouter.priority = 10;

module.exports = proxyRouter;
