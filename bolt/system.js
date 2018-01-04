'use strict';

/**
 * @module bolt/bolt
 */

const linuxUser = require.try(true, '@simpo/linux-user');
const Promise = require('bluebird');
const chown = Promise.promisify(require('chownr'));
const exec = Promise.promisify(require('child_process').exec);
const fs = require('fs');
const stat = Promise.promisify(fs.stat);

/**
 * Create a given user.
 *
 * @private
 * @param {boltConfig} config   The bolt config object.
 * @returns {Promise.<Object>}
 */
function _createUser(config) {
  var options = {username: config.userName};
  if (config.homeDir) options.d = config.homeDir;
  return linuxUser.addUser(options)
    .then(result=>linuxUser.getUserInfo(config.userName));
}

/**
 * Add user and group specified in supplied config if not already present.
 * Endure all the application directories are appropriately accessible for
 * the given user.
 *
 * @param {boltConfig} config       The bolt config objecct.
 * @returns {Promise.<boltConfig>}  Promise resolving to the bolt config object.
 */
function addUser(config) {
  if (config.userName) {
    return linuxUser.isUser(config.userName).then(
      isUser=>(!isUser?_createUser(config):true)
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
