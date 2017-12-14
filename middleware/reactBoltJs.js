'use strict';

/**
 * Serve browser ReactBolt files
 *
 * @public
 * @param {BoltApplication} app   The bolt application instance.
 */
function init(app) {
	// @annotation priority 8

	app.get('/lib/ReactBolt.js', (req, res, next)=>res.type('.js').status(200).send(''));
	app.get('/lib/ReactBolt.js.map', (req, res, next)=>res.type('.js').status(200).send(req.app.__reactBoltJsMap));
	app.get('/lib/ReactBolt.min.js', (req, res, next)=>res.type('.js').status(200).send(req.app.__reactBoltJsMin));
	app.get('/lib/ReactBolt.min.js.map', (req, res, next)=>res.type('.js').status(200).send(req.app.__reactBoltJsMinMap));
}

module.exports = init;
