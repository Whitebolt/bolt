'use strict';

function req(component) {
	return bolt.get(component, 'req', {});
}

module.exports = req;