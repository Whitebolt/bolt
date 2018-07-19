'use strict';

function path(component) {
	return bolt.getPathFromRequest(bolt.get(component, 'req', {}));
}

module.exports = path;