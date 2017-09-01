'use strict';

const passport = require('passport');
const Strategy = require('passport-local').Strategy;
const Promise = require('bluebird');
const bcrypt = require('bcrypt');
const compare = Promise.promisify(bcrypt.compare);

/**
 * @todo  Reduce inefficiencies with some form of caching, indexes and DbRefs.
 */


/**
 * Create the session authentication.
 *
 * @public
 * @param {BoltApplication} app   The bolt application instance.
 */
function init(app) {
  // @annotation priority 5

  const hideUserFieldsFromSession = ['password', '_id'];

  /**
   * Login the given user.
   *
   * @public
   * @param {string} username         User name to use.
   * @param {string} password         Password to use.
   * @returns {Promise.<boolean>}     Promise resolving to boolean, which equals, did _login succeed?
   */
  function loginUser(username, password) {
    return _getUserByAccount(username)
      .then(user=>{
        return compare(password, user.password)
          .then(authenticated =>(!authenticated ? false : user));
      });
  }

  /**
   * Get account information for given user.
   *
   * @private
   * @param username                  Username to lookup.
   * @returns {Promise.<Object>}      Promise resolving to user data (ie. their profile).
   */
  function _getUserByAccount(username) {
    return app.db.collection('users').findOne({
      $or:[{accountEmail: username}, {userName: username}]
    }).then(user => (user?user:Promise.reject('User not found')));
  }

  /**
   * Create a projection object for use in mongo query based on given fields to hide.
   *
   * @private
   * @param {Array} hideFields      Fields to hide.
   * @returns {Object}              The projection object.
   */
  function _getHideFieldsProjection(hideFields) {
    let projection = {};
    hideFields.forEach(field=>{projection[field] = false;});
    return projection;
  }

  /**
   * Get user profile from their user id.
   *
   * @private
   * @param {string|external:objectId} id   Id to lookup.
   * @param {Array} [hideFields=[]]         Fields to hide in results.
   * @returns {Promise.<Object>}            Promise resolving to user profile.
   */
  function _getUserRecordById(id, hideFields=[]) {
    return app.db.collection('users')
      .findOne(
        {_id: bolt.mongoId(id)},
        _getHideFieldsProjection(hideFields)
      )
      .then(user => (user?user:Promise.reject('User not found')));
  }

  /**
   * Log user in.
   *
   * @private
   * @param {string} username     Username to use for login.
   * @param {string} password     Password to use for login.
   * @param {Function} callback   Callback to fire when login succeeds or fails.
   */
  function _login(username, password, callback){
    loginUser(username, password).then(user => {
      if (user === false) {
        callback(null, false)
      } else {
        callback(null, user);
      }
    }, err=>callback(err, false));
  }

  /**
   * Find groups that given user is member of.
   *
   * @private
   * @param {string|external:objectId} userId                  User id of lookup user.
   * @param {Array.<string|external:objectId>} [groups=[]]     Groups to append to results.
   * @returns {Promise.<string[]>}                             Ids of groups that user is a member of.
   */
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

  /**
   * Find groups that given user is member of.
   *
   * @private
   * @param {string|external:objectId} userId                  User id of lookup user.
   * @param {Array.<string|external:objectId>} [groups=[]]     Groups to append to results.
   * @returns {Promise.<string[]>}                             Ids of groups that user is a member of.
   */
  function _getGroups(userId, groups=[]) {
    let groupCount = groups.length;
    let users = groups.map(group=>group._id);
    if (userId) users.unshift(userId);

    return app.db.collection('groups').find({'users':{$elemMatch:{$in: users}}}).toArray().map(group=>{
      return {_id: bolt.mongoId(group._id), name: group.name}
    }).then(groups=>((groups.length > groupCount) ? _getGroups(userId, groups) : groups));
  }

  /**
   * Populate the session object with user profile and group information.
   *
   * @todo Why does promise resolve to group membership data?
   *
   * @private
   * @param {Object} session        The session object to populate.
   * @returns {Promise.<Array>}     Promise resolving to groups the user is a member of.
   */
  function _populateSessionWithUserData(session){
    let id = session.passport.user.toString();
    return _getUserRecordById(id, hideUserFieldsFromSession)
      .then(user=>{session.user = user; return user;})
      .then(user=>getGroups([bolt.mongoId(id), 'Authenticated']))
      .then(groups=>{session.groups = groups; return groups;})
  }

  /**
   * Populate a session object for logged-in user.
   *
   * @todo Why does promise resolve to group membership data?
   *
   * @param {external:express:request} req      Request to populate session on.
   * @returns {Promise.<Array>}                 Promise resolving to groups the user is a member of.
   */
  function _populateUserSessionData(req){
    return _populateSessionWithUserData(req.session);
  }

  /**
   * Populate session object for anonymous user.
   *
   * @todo Why does promise resolve to group membership data?
   *
   * @private
   * @param {external:express:request} req      Request to populate session on.
   * @returns {Promise.<Array>}                 Promise resolving to groups the user is a member of.
   */
  function _populateAnnoymousSessionData(req){
    let session = req.session;
    session.user = {};
    return getGroups(['Annoymous']).then(groups=>{session.groups = groups;});
  }

  passport.use(new Strategy(_login));

  passport.serializeUser((data, callback) => {
    return callback(null, data._id.toString());
  });

  passport.deserializeUser((id, callback)=>{
    _getUserRecordById(id).nodeify(callback);
  });

  app.use(passport.initialize());
  app.use(passport.session());
  app.use((req, res, next)=>{
    if (req.session) {
      const passport = req.session.passport;

      ((!(passport && passport.user)) ?
          _populateAnnoymousSessionData(req) :
          _populateUserSessionData(req)
      )
        .finally(()=>next());
    } else {
      next();
    }
  });
}

module.exports = init;
