'use strict';

let linuxUser;
try {linuxUser = require('linux-user');} catch (err) {}
const chown = require('bluebird').promisify(require('chownr'));

function _createUserIfNotCreated(isUser, config) {
  if (!isUser) {
    var options = {username: config.userName};
    if (config.homeDir) options.d = config.homeDir;
    return linuxUser.addUser(options)
      .then(result=>linuxUser.getUserInfo(config.userName));
  }
  return true;
}

function addUser(config) {
  if (config.userName) {
    return linuxUser.isUser(config.userName).then(
      isUser=>_createUserIfNotCreated(isUser, config)
    ).then(
      isUser=>linuxUser.getUserInfo(config.userName)
    ).then(user=>{
      return chown(user.homedir, user.uid, user.gid).then(
        result=>user
      );
    }).then(user=>{
      config.uid = user.uid;
      config.gid = user.gid;
      return config;
    });
  } else {
    return config;
  }
}

module.exports = {
  addUser
};