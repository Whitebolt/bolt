'use strict';

function res(component) {
	return bolt.get(component, 'res', {});
}

module.exports = res;