'use strict';

function method(component) {
	return bolt.get(component, 'req.method', '').toLowerCase();
}

module.exports = method;