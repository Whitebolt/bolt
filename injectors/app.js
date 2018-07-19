'use strict';

function app(component) {
	return bolt.get(component, 'req.app', {});
}

module.exports = app;