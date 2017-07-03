'use strict';

const passport = require('passport');
const Strategy = require('passport-local').Strategy;
const Promise = require('bluebird');
const bcrypt = require('bcrypt');
const compare = Promise.promisify(bcrypt.compare);

/**
 * @todo  Reduce inefficiencies with some form of caching, indexes and DbRefs.
 */


function init(app) {
  // @annotation priority 3

  const hideUserFieldsFromSession = ['password', '_id'];

  function loginUser(username, password) {
    return getUserByAccount(username)
      .then(user=>{
        return compare(password, user.password)
          .then(authenticated =>(!authenticated ? false : user));
      });
  }

  function getUserByAccount(username) {
    return app.db.collection('users').findOne({
      $or:[{accountEmail: username}, {userName: username}]
    }).then(user => (user?user:Promise.reject('User not found')));
  }

  function getHideFieldsProjection(hideFields) {
    let projection = {};
    hideFields.forEach(field=>{projection[field] = false;});
    return projection;
  }

  function getUserRecordById(id, hideFields=[]) {
    return app.db.collection('users')
      .findOne(
        {_id: bolt.mongoId(id)},
        getHideFieldsProjection(hideFields)
      )
      .then(user => (user?user:Promise.reject('User not found')));
  }

  function login(username, password, callback){
    loginUser(username, password).then(user => {
      if (user === false) {
        callback(null, false)
      } else {
        callback(null, user);
      }
    }, err=>callback(err, false));
  }

  function getGroups(userId, groups=[]) {
    if (bolt.isArray(userId)) {
      let lookup = new Map();

      return Promise.all(userId.map(userId=>_getGroups(userId, groups)))
        .then(groups=>bolt.flatten(groups))
        .filter(group=>{
          if (lookup.has(group._id)) return false;
          lookup.set(group._id, true);
          return true;
        });
    } else {
      return _getGroups(userId, groups);
    }
  }

  function _getGroups(userId, groups=[]) {
    let groupCount = groups.length;
    let users = groups.map(group=>group._id);
    if (userId) users.unshift(userId);

    return app.db.collection('groups').find({'users':{$elemMatch:{$in: users}}}).toArray().map(group=>{
      return {_id: bolt.mongoId(group._id), name: group.name}
    }).then(groups=>((groups.length > groupCount) ? _getGroups(userId, groups) : groups));
  }

  function populateSessionWithUserData(session){
    let id = session.passport.user.toString();
    return getUserRecordById(id, hideUserFieldsFromSession)
      .then(user=>{session.user = user; return user;})
      .then(user=>getGroups([bolt.mongoId(id), 'Authenticated']))
      .then(groups=>{session.groups = groups; return groups;})
  }

  function populateUserSessionData(req){
    return populateSessionWithUserData(req.session);
  }

  function populateAnnoymousSessionData(req){
    let session = req.session;
    session.user = {};
    return getGroups(['Annoymous']).then(groups=>{session.groups = groups;});
  }

  passport.use(new Strategy(login));

  passport.serializeUser((data, callback) => {
    return callback(null, data._id.toString());
  });

  passport.deserializeUser((id, callback)=>{
    getUserRecordById(id).nodeify(callback);
  });

  bolt.use(app, passport.initialize());
  bolt.use(app, passport.session());
  bolt.use(app, (req, res, next)=>{
    if (req.session) {
      const passport = req.session.passport;

      ((!(passport && passport.user)) ?
          populateAnnoymousSessionData(req) :
          populateUserSessionData(req)
      )
        .finally(()=>next());
    } else {
      next();
    }
  });
}

module.exports = init;