'use strict';

function config(component) {
	return bolt.get(component, 'req.app.locals', {});
}

module.exports = config;