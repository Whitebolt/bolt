'use strict';

const Promise = require('bluebird');
const readFile = Promise.promisify(require('fs').readFile);
const IO = require('socket.io');

/**
 * Run the given express app, binding to correct port.
 *
 * @private
 * @param {Object} app      Express application object.
 * @returns {Promise}       Promise resolved when app has launched fully.
 */
function _runApp(app) {
  if (app.config.uid && app.config.gid && !app.config.development) { // downgrade from route just before going live.
    process.setgid(app.config.gid);
    process.setuid(app.config.uid);
  }

  return new Promise(resolve => {
    let server = app.listen(app.config.port, () => {
      bolt.fire('appListening', app.config.port);
      return bolt.fire(()=>{
        app.io = IO(server);
        app.io.sockets.setMaxListeners(50);
      }, 'ioServerLaunch', app).then(()=>
        readFile('./welcome.txt', 'utf-8').then(welcome => {
          console.log(welcome);
          return welcome;
        }))
        .then(() => resolve(app));
    });
  });
}

/**
 * Run the given express app, binding to correct port.
 *
 * @public
 * @param {Object} app      Express application object.
 * @returns {Promise}       Promise resolved when app has launched fully.
 */
function runApp(app) {
  return bolt.fire(()=>_runApp(app), 'runApp', app).then(() => app);
}

module.exports = {
  runApp
};
