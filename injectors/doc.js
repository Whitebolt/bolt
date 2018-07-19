'use strict';

function doc(component) {
	return bolt.get(component, 'req.doc', {}, true);
}

module.exports = doc;