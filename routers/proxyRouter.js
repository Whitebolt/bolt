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

function parseReturnedData(options, req) {
  if (options.text.indexOf('<'+options.options.delimiter) === -1) return Promise.resolve(options.text);
  let template = bolt.compileTemplate(options);
  return Promise.resolve(template({}, req, {}));
}

function _ejsIntercept(options) {
  if (!contentIsType(options.type, options.proxyConfig.proxyParseForEjs)) return Promise.resolve(options);

  return parseReturnedData(options, options.req).then(text=>{
    options.text = text;
    return options;
  });
}

function _initIntercept(app, proxyConfig) {
  return (rsp, data, req, res, callback)=>{
    let type = getTypesArray(res);
    let interceptCount = 0;

    let options = {
      text:iconv.decode(data, getEncodingOfType(type)),
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
      return interceptCaller(interceptCount).then(options=>options.text);
    }

    return data;
  };
}

function _initSlugger(app, appProxyConfig, config) {
  let _slugger = bolt.require.getModule(true, app.config.root.map(root=>root+appProxyConfig.slugger)).then(slugger=>{
    config.proxyReqPathResolver = slugger(appProxyConfig);
    return config.proxyReqPathResolver;
  });

  return (req)=>{
    return _slugger.then(()=>config.proxyReqPathResolver(req));
  }
}

function _initInterceptModule(app, appProxyConfig, config) {
  return bolt.require.getModule(true, app.config.root.map(root=>root+appProxyConfig.intercept)).then(intercept=>{
    appProxyConfig.intercepts.push(intercept);
    return config;
  });
}

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

function _initOptDecorateRequest(app, appProxyConfig) {
  return (proxyReqOpts, srcReq)=>{
    if (appProxyConfig.host) proxyReqOpts.headers.host = appProxyConfig.host;
    return proxyReqOpts;
  };
}

function _proxyRouter(app, appProxyConfig) {
  let config = {
    reqAsBuffer: true,
    reqBodyEncoding: null,
    proxyReqOptDecorator: _initOptDecorateRequest(app, appProxyConfig),
    proxyReqBodyDecorator: _initBodyDecorateRequest(app, appProxyConfig),
    userResDecorator: _initIntercept(app, appProxyConfig)
  };

  appProxyConfig.intercepts = appProxyConfig.intercepts || [];

  if (appProxyConfig.proxyParseForEjs) config.intercepts = appProxyConfig.intercepts.push(_ejsIntercept);
  if (appProxyConfig.slugger) config.proxyReqPathResolver = _initSlugger(app, appProxyConfig, config);
  if (appProxyConfig.intercept) _initInterceptModule(app, appProxyConfig, config);

  return proxy(appProxyConfig.forwardPath, config);
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
