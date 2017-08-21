'use strict';

const csp = require('helmet-csp');
const hidePoweredBy = require('hide-powered-by');
const hsts = require('hsts');
const ienoopen = require('ienoopen');
const nosniff = require('dont-sniff-mimetype');
const frameguard = require('frameguard');
const xssFilter = require('x-xss-protection');
const express_enforces_ssl = require('express-enforces-ssl');

function _getConnectSrc(app, domains) {
  const connectSrc = [].concat(app.config.domains).map(domain=>'https://'+domain);
  if (app.config.development) connectSrc.unshift('https://localhost:' + app.config.port);
  return connectSrc.concat(connectSrc.map(domain=>domain.replace('https://','wss://')));
}
function _mergeConfigDirectives(app, directives) {
  Object.keys(app.config.csp || {}).forEach(directive=>{
    if (bolt.isArray(app.config.csp[directive])) {
      directives[directive] = bolt.uniq((directives[directive] || []).concat(app.config.csp[directive]));
    }
  });

  return directives;
}

function _getDirectives(app) {
  const domains = ["'self'"];

  return _mergeConfigDirectives(app, {
    defaultSrc: domains,
    scriptSrc: domains,
    connectSrc: _getConnectSrc(app, domains),
    frameSrc: domains,
    styleSrc: domains,
    fontSrc: domains,
    imgSrc: domains,
    reportUri: '/report-csp-violation',
    objectSrc: ["'none'"],
    baseUri: domains,
    upgradeInsecureRequests: true
  });
}

/**
 * Add security middleware.
 *
 * @public
 * @param {BoltApplication} app   The bolt application instance.
 */
function init(app) {
  // @annotation priority 3

  let cspMiddleware = csp({
    directives: _getDirectives(app),
    loose: false,
    reportOnly: false,
    setAllHeaders: false,
    disableAndroid: false,
    browserSniff: true
  });

  let hstsMiddleware = hsts({
    maxAge: 19 * 7 *24 * 60 * 60,
    includeSubDomains: true,
    preload: true
  });

  let hidePoweredByMiddleware = hidePoweredBy({
    setTo: 'PHP 7.2.0'
  });

  let framegardMiddleware = frameguard({
    action: 'deny'
  });

  app.enable('trust proxy');

  app.use(
    cspMiddleware,
    hidePoweredByMiddleware,
    express_enforces_ssl(),
    hstsMiddleware,
    ienoopen(),
    nosniff(),
    framegardMiddleware,
    xssFilter()
  );
};

module.exports = init;
