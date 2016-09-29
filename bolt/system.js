'use strict';

/**
 * @module bolt/bolt
 */

let linuxUser;
try {linuxUser = require('linux-user');} catch (err) {}
const Promise = require('bluebird');
const chown = Promise.promisify(require('chownr'));
const exec = Promise.promisify(require('child_process').exec);
const fs = require('fs');
const stat = Promise.promisify(fs.stat);

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
    ).then(user=> {
      return chown(user.homedir, user.uid, user.gid).then(
        result=>user
      );
    }).then(user=>{
      return Promise.all(bolt.makeArray(config.root).map(root=>{
        let publicDir = root + 'public/';
        return stat(publicDir).then(
          stat=>exec('setfacl -RLm "u:'+user.uid+':rwx,d:'+user.uid+':rwx,g:'+user.gid+':rwx" '+publicDir),
          err=>undefined
        ).then(()=>user);
      }));
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