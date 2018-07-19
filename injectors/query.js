'use strict';

function query(component) {
	return bolt.get(component, 'req.query', {}, true);
}

module.exports = query;