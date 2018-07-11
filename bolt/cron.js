'use strict';
// @annotation zone server

const nodeCron = require('node-cron');


function cron(...params) {
	return nodeCron.schedule(...params);
}

module.exports = {
	cron
};