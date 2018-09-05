'use strict';

const Joi = require('joi');

const xIsSchema = /\/schemas\/\w+\.js$/;

module.exports = function() {
	// @annotation key moduleSetScopeJs

	const boltJoi = Joi.extend(joi=>({
		base: joi.array(),
		name: 'array',
		coerce(value, state, options) {
			if (options.convert) return bolt.makeArray(value);
			return value;
		}
	}));

	return event=>{
		if (xIsSchema.test(event.target)) {
			event.scope.Joi = boltJoi;
		}
	}
};