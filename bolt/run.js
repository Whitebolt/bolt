'use strict';

/**
 * @module bolt/bolt
 */

const Promise = require('bluebird');
const IO = require('socket.io');
const figlet =  Promise.promisify(require('figlet'));


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

  return new Promise(resolve=>{
    let server;

    if (app.config.development) {
      try {
        const fs = require('fs');
        let options = {
          key: fs.readFileSync(boltRootDir + '/server.key'),
          cert: fs.readFileSync(boltRootDir + '/server.crt'),
          requestCert: false,
          rejectUnauthorized: false
        };
        server = require('https').createServer(options, app);
      } catch(err) {}
    }
    if (!server) server = require('http').createServer(app);

    server.listen(app.config.port, ()=>{
      bolt.fire('appListening', app.config.port);
      return bolt.fire(()=>{
        app.io = IO(server);
        app.io.sockets.setMaxListeners(50);
      }, 'ioServerLaunch', app).then(()=>{
          let serverName = bolt.upperFirst(bolt.camelCase(app.config.serverName));
          return figlet(`${serverName} v${app.config.version}`).then(welcome=>{
            console.log(welcome);
            return welcome;
          });
        })
        .then(() => resolve(app));
    });


    /*let server = app.listen(app.config.port, () => {

    });*/
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
