'use strict';

function doc(component) {
	return bolt.get(component, 'res.locals.doc', {}, true);
}

module.exports = doc;