'use strict';

const {Memory} = require('map-watch');
const $private = new Memory();
const errorClasses = new Map();

let errorConfig;
bolt.on('configLoaded', config=>{
	errorConfig = config.errors || errorConfig || {};
});

errorClasses.set('error', Error);
errorClasses.set('reference', ReferenceError);
errorClasses.set('range', RangeError);
errorClasses.set('syntax', SyntaxError);


class ErrorFactory {
	constructor(domain) {
		$private.set(this, 'domain', domain);
	}

	registerType(id, errorClass, global=false) {
		if (!global) {
			$private.set(this, 'errorClasses', id, errorClass);
		} else {
			errorClass.set(id, errorClass);
		}
	}

	error(id, data) {
		const domain = $private.get(this, 'domain');

		if (!errorConfig.hasOwnProperty(domain)) throw new SyntaxError(`Error domain ${domain} does not exist.`);
		if (!errorConfig[domain].hasOwnProperty(id)) throw new SyntaxError(`Error id ${id} does not exist in domain: ${domain}.`);

		const errorType = errorConfig[domain][id].type || 'error';

		let errorClass = $private.get(this, 'errorClasses', errorType) || errorClasses.get(errorType);
		if (!errorClass) throw new SyntaxError(`Error type ${errorType} does not exist for domain: ${domain}.`);

		const message = bolt.runTemplate(errorConfig[domain][id].message, data);
		return new errorClass(message);
	}
}

module.exports = {
	ErrorFactory
};