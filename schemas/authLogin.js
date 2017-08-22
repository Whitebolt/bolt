'use strict';

module.exports = bolt.Joi.object().keys({
  username: bolt.Joi.string().min(4).required(),
  password: bolt.Joi.string().min(8).required()
});