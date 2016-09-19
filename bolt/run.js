'use strict';

const Promise = require('bluebird');
const readFile = Promise.promisify(require('fs').readFile);
const IO = require('socket.io');

function _runApp(app) {
  if (app.config.uid && app.config.gid && !app.config.development) { // downgrade from route just before going live.
    process.setgid(app.config.gid);
    process.setuid(app.config.uid);
  }

  return new Promise(resolve => {
    let server = app.listen(app.config.port, () => {
      bolt.fire('appListening', app.config.port);
      return bolt.fire(()=>{app.io = IO(server);}, 'ioServerLaunch', app).then(()=>
        readFile('./welcome.txt', 'utf-8').then(welcome => {
          console.log(welcome);
          return welcome;
        }))
        .then(() => resolve(app));
    });

    //console.log(app.controllerRoutes);
  });
}

function runApp(app) {
  return bolt.fire(()=>_runApp(app), 'runApp', app).then(() => app);
}

module.exports = {
  runApp
};
