'use strict';

/**
 * @module bolt/bolt
 */

const util = require('util');
const figlet =  util.promisify(require('figlet'));
const {upgrade} = require('websocket-express');

const { r, g, b, w, c, m, y, k } = [
	['r', 1], ['g', 2], ['b', 4], ['w', 7],
	['c', 6], ['m', 5], ['y', 3], ['k', 0]
].reduce((cols, col) => ({...cols,  [col[0]]: f => `\x1b[3${col[1]}m${f}\x1b[0m`}), {});

const colourLookup = {
	red:r, green:g, blue:b, white:w, cyan:c, magenta:m, yellow:y
};

function colour(name, text) {
	return text?colourLookup[name](text):colourLookup[name];
}

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

  return new Promise(async (resolve)=>{
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

    const pidController = new bolt.Pid_Controller('/tmp/run/bolt/pids', app.config.name);
    await pidController.create();

    server.listen(app.config.port, async ()=>{
      bolt.emit('appListening', app.config.port);
      let serverName = bolt.upperFirst(bolt.camelCase(app.config.serverName));
      let welcome = await figlet(`${serverName} `);
      let version = await figlet(`v${app.config.version}`);
      welcome = welcome.split('\n').map(line=>colour('blue', line));
      version = welcome.split('\n').map(line=>colour('green', line));
      
      console.log(colour('blue', welcome));
      bolt.emit('appRunning', app.config.name, process.hrtime(global.startTime));
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
