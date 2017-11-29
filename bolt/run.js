'use strict';

/**
 * @module bolt/bolt
 */

const Promise = require('bluebird');
const figlet =  Promise.promisify(require('figlet'));
const {upgrade} = require('websocket-express');

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

    server.listen(app.config.port, async ()=>{
      bolt.emit('appListening', app.config.port);
      let serverName = bolt.upperFirst(bolt.camelCase(app.config.serverName));
      let welcome = await figlet(`${serverName} v${app.config.version}`)
      console.log(welcome);

      console.log('Load took: ', process.hrtime(global.startTime)[0], 'secs');
      resolve(app);
    });

    upgrade(server, app);


  });
}

/**
 * Run the given express app, binding to correct port.
 *
 * @public
 * @param {Object} app      Express application object.
 * @returns {Promise}       Promise resolved when app has launched fully.
 */
async function runApp(app) {
  await bolt.emitThrough(()=>_runApp(app), 'runApp', app);
  return app;
}

module.exports = {
  runApp
};
