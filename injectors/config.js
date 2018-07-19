'use strict';

function config(component) {
	return bolt.get(component, 'req.app.config', {});
}

module.exports = config;