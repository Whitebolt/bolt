'use strict';

module.exports = schemas=>Joi.object().keys({
	username: Joi.string().min(4).required(),
	password: Joi.string().min(8).required()
});
