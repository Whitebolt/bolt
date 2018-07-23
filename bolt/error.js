'use strict';
// @annotation zone server manager

const errorClasses = new Map();
const {xSubstitutionsAt} = bolt.consts || require('./consts');

let errorConfig;
bolt.on('configLoaded', config=>{
	errorConfig = config.errors || errorConfig || {};
});

class ErrorFactory {
	constructor(domain) {
		this.domain = domain;
		this.error = this.error.bind(this);
		this.reject = this.reject.bind(this);
	}

	static set(id, errorClass) {
		errorClasses.set(id, errorClass);
	}

	error(id, data={}) {
		if (!errorConfig.hasOwnProperty(this.domain)) throw errorFactoryError('IncorrectDomain', {domain:this.domain});
		if (!errorConfig[this.domain].hasOwnProperty(id)) throw errorFactoryError('IncorrectId', {id, domain:this.domain});

		const errorType = errorConfig[this.domain][id].type || 'error';

		let errorClass = errorClasses.get(errorType);
		if (!errorClass) throw errorFactoryError('IncorrectType', {errorType, domain:this.domain});

		const message = {
			...bolt.omit(errorConfig[this.domain][id], ['type']),
			message: bolt.substituteCSP(errorConfig[this.domain][id].message, data, xSubstitutionsAt)
		};

		return new errorClass((Object.keys(message).length > 1)?message:message.message);
	}

	reject(id, data) {
		return Promise.reject(this.error(id, data));
	}
}

const errorFactoryError = (new ErrorFactory('ErrorFactory')).error;

ErrorFactory.set('error', Error);
ErrorFactory.set('reference', ReferenceError);
ErrorFactory.set('range', RangeError);
ErrorFactory.set('syntax', SyntaxError);

module.exports = {
	ErrorFactory
};