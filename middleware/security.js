'use strict';

const csp = require('helmet-csp');
const hidePoweredBy = require('hide-powered-by');
const hsts = require('hsts');
const ienoopen = require('ienoopen');
const nosniff = require('dont-sniff-mimetype');
const frameguard = require('frameguard');
const xssFilter = require('x-xss-protection');

function _getConnectSrc(app, domains) {
	const connectSrc = [].concat(app.locals.domains).map(domain=>'https://'+domain);
	if (app.locals.development) connectSrc.unshift('https://localhost:' + app.locals.port);
	return connectSrc.concat(connectSrc.map(domain=>domain.replace('https://','wss://')));
}
function _mergeConfigDirectives(app, directives) {
	Object.keys(app.locals.csp || {}).forEach(directive=>{
		if (bolt.isArray(app.locals.csp[directive])) {
			directives[directive] = bolt.uniq((directives[directive] || []).concat(app.locals.csp[directive]));
		}
	});

	return directives;
}

function _getDirectives(app) {
	const domains = ["'self'", 'data:'];

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
	// @annotation priority 4

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
		setTo: app.locals.poweredBy || 'Powered by Bolt - https://whitebolt.net/software-development/'
	});


	let frameguardConfig = app.locals.frameGuard || 'sameorigin';
	if ((frameguardConfig === 'sameorigin') && (frameguardConfig === 'deny')) frameguardConfig = {
		action: 'allow-from',
		domain: frameguardConfig
	};
	let framegardMiddleware = frameguard(frameguardConfig);

	app.enable('trust proxy');

	app.use(
		cspMiddleware,
		hidePoweredByMiddleware,
		//express_enforces_ssl(),
		hstsMiddleware,
		ienoopen(),
		nosniff(),
		//framegardMiddleware,
		xssFilter()
	);
}

module.exports = init;
