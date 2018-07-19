'use strict';

function body(component) {
	return bolt.get(component, 'req.body', {}, true);
}

module.exports = body;