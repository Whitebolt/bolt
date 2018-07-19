'use strict';

function view(component) {
	return bolt.get(component, 'view', {});
}

module.exports = view;