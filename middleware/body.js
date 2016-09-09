'use strict';

const bodyParser = require('body-parser');

function init(app) {
  app.use(bodyParser.urlencoded({
    extended: true
  }));
  app.use(bodyParser.json());
  app.use(bodyParser.text());
  app.use(bodyParser.raw());
};

init.priority = 2;
module.exports = init;