'use strict';

function session(component) {
	return bolt.get(component, 'req.session', {}, true);
}

module.exports = session;