'use strict';

function parent(component) {
	return bolt.get(component, 'parent', {}, true);
}

module.exports = parent;