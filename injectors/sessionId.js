'use strict';

function sessionId(component) {
	return bolt.get(component, 'req.sessionID');
}

module.exports = sessionId;