'use strict';

/**
 * @module bolt/bolt
 */

const nodemailer = require('nodemailer');

/**
 * Send an email via nodemailer.
 *
 * @todo  This very basic, add options and generally make more robust and advanced.
 *
 * @public
 * @param {Object} app      The bolt application firing this.
 * @param {string} email    The email content.
 */
function sendEmail(app, email) {
  nodemailer.createTransport({
    host: 'gabriel.whitebolt',
    ignoreTLS: true,
    secure: false
  }).sendMail(email).then(info => {
    console.log('Message sent: ' + info.response);
    return info;
  }, err => {
    console.log(err);
  });

}

module.exports = {
  sendEmail
};