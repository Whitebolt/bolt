'use strict';

const rrulestr = require('@simpo/rrule').rrulestr;
const dateParser = require('ical-date-parser');
const BoltDatabaseQueryConfig = require('./BoltDatabaseQueryConfig');
const prioritySorter = bolt.prioritySorter;
const _prioritySorter = prioritySorter({sortProperty:'_priority'});

/**
 * Get lookup ids for given access level.  These cascade so read includes edit and admin; edit includes read ...etc.
 *
 * @private
 * @param {Object} acl              Acl field value.
 * @param {string} accessLevel      Access level.
 * @returns {Array.<string>}        The allowed ids for that level given acl object supplied.
 */
function _getAccessLevelLookup(acl, accessLevel) {
  if (accessLevel === 'read') {
    return (acl.security.administrators || []).concat(acl.security.readers || []).concat(acl.security.editors || [])
  } else if (accessLevel === 'edit') {
    return (acl.security.administrators || []).concat(acl.security.editors || [])
  } else if (accessLevel === 'admin') {
    return bolt.clone(acl.security.administrators || []);
  }

  return [];
}

/**
 * Get the ids of the groups the current session user belongs to.
 *
 * @private
 * @param {Object} session      Session object.
 * @returns {Array.<string>}    Ids of groups session user belongs to.
 */
function _getAccessGroups(session) {
  let ids = (session.groups || []).map(group=>group._id).filter(id=>id);
  if (session && session.passport && session.passport.user) ids.unshift(session.passport.user);
  return ids;
}

/**
 * Does at least one id a series of authorised ids fall within given group ids.
 *
 * @todo refactor to use find().
 *
 * @private
 * @param {Array.<string>} groupIds         Group ids to test within.
 * @param {Array.<string>} authorisedIds    Ids to test for.
 * @returns {boolean}                       Is there a match?
 */
function _idIsInGroup(groupIds, authorisedIds) {
  let found;
  groupIds.every(groupId=>{
    authorisedIds.every(aid=>{
      if (groupId.toString() === aid.toString()) found = aid;
      return !found;
    });
    return !found;
  });

  return (found !== undefined);
}

/**
 * Is session user authjorised to view given document int its acl?
 *
 * @private
 * @param {Object} doc                     The document to test authorisation on.
 * @param {Object} session                 The session object.
 * @param {string} [accessLevel='read']    The access level.
 * @returns {boolean}                      Is session user authorised?
 */
function _isAuthorised(doc, session, accessLevel='read') {
  if (!doc || !doc._acl || !doc._acl.security) return false;

  let authorisedIds = _getAccessLevelLookup(doc._acl, accessLevel.toLowerCase().trim());
  if (authorisedIds.length) {
    let groupIds = _getAccessGroups(session);
    return _idIsInGroup(groupIds, authorisedIds);
  }
  return false;
}

/**
 * Should current doc be visible at this moment in time according to the iCall RRules defined in the document acl.
 *
 * @private
 * @param {Object} doc        The document to test authorisation on.
 * @returns {boolean}         Should document be visible?
 */
function _isAuthorisedVisibility(doc) {
  if (doc && doc._acl && doc._acl.visibility && acl.visibility) {
    let ruleString = '';
    let acl = doc._acl;

    Object.keys(acl.visibility).forEach(key=>{
      if ((key === 'DTSTART') || (key === 'DTEND') || (key === 'fields')) return;
      if (bolt.isString(acl.visibility[key])) {
        ruleString += key + ':' + acl.visibility[key] + '\n';
      } else if (bolt.isArray(acl.visibility[key])) {
        ruleString += key + ':' + acl.visibility[key].map(item=>{
            if (bolt.isString(item)) {
              return item;
            } else {
              return Object.keys(item).map(itemId=>itemId + '=' + item[itemId]).join(';');
            }
          }).join(',') + '\n';
      } else {
        ruleString += key + ':' + Object.keys(acl.visibility[key]).map(itemId=>
            itemId + '=' + acl.visibility[key][itemId]
          ).join(';') + '\n';
      }
    });

    let duration = dateParser(acl.visibility['DTEND']) - dateParser(acl.visibility['DTSTART']);
    let rrule = rrulestr(ruleString);
    let now = Date.now();
    let ranges = rrule
      .all()
      .map(date=>Date.parse(date))
      .filter(date=>(new Date(date+duration) > now))
      .filter(date=>(date <= now));

    return (ranges.length > 0);
  }

  return true;
}

/**
 *  @external express:request
 *  @see {https://github.com/expressjs/express/blob/master/lib/request.js}
 *
 * @external ObjectId
 * @see {https://github.com/mongodb/js-bson/blob/1.0-branch/lib/bson/objectid.js}
*/

/**
 * Create a database config object from given options.
 *
 * @private
 * @param {Object|BoltDatabaseQueryConfig} options      Config to pass to BoltDatabaseQueryConfig constructor.
 * @returns {BoltDatabaseQueryConfig}                   The new BoltDatabaseQueryConfig instance or the original
 *                                                      supplied parameter if it was a BoltDatabaseQueryConfig already.
 */
function _createBoltDatabaseQueryConfig(options) {
  return ((options instanceof BoltDatabaseQueryConfig) ? options : new BoltDatabaseQueryConfig(options));
}

/**
 * Remove fields that given session user should not see.
 *
 * @private
 * @param {Object} doc            Doc to filter fields on.
 * @param {Object} session        Session object.
 * @param {string} accessLevel    Access level to apply
 * @returns {Object}              Filtered doc.
 */
function _removeUnauthorisedFields(doc, session, accessLevel) {
  if (doc && doc._acl && doc._acl.fields) {
    Object.keys(doc._acl.fields || {})
      .map(field=> {
        let auth = _isAuthorised(doc._acl.fields[field], session, accessLevel);
        if (!auth) return field;
        return (!_isAuthorisedVisibility(doc._acl.fields[field]) ? field : undefined);
      })
      .filter(field=>field)
      .forEach(field=>{
        if (doc.hasOwnProperty(field)) delete doc[field];
      });

    delete doc._acl;
  }

  return doc;
}

/**
 * Remove fields added to doc during querying operation.
 *
 * @private
 * @param {Object} doc            Document to filter fields from.
 * @param {Object} projection     Projection object.
 * @returns {Object}              The filtered document.
 */
function _removeAddedFields(doc, projection={}) {
  if (!projection._acl) delete doc._acl;
  if (!projection._id) delete doc._id;
  return doc;
}

/**
 * Create a projection object from the given queryConfig.
 *
 * @private
 * @param {BoltDatabaseQueryConfig} queryConfig     The query config instance.
 * @returns {Object|undefined}                      The projection object.
 */
function _createProjection(queryConfig) {
  return (queryConfig.projection ?
      Object.assign({}, queryConfig.projection, {'_acl':true, '_id':true}) :
      undefined
  );
}

/**
 * Get a collection instance for given query config instance.
 *
 * @private
 * @param {BoltDatabaseQueryConfig} queryConfig     The query config to use.
 * @returns {Object}                                The collection instance.
 */
function _getCollection(queryConfig) {
  return queryConfig.db.collection(queryConfig.collection);
}

/**
 * Perform a query given the supplied query config.
 *
 * @private
 * @param {BoltDatabaseQueryConfig} queryConfig     Query config to use.
 * @returns {Object}                                Results set.
 */
function _doQuery(queryConfig) {
  let method = (queryConfig.id?'findOne':'find');
  let projection = _createProjection(queryConfig);
  let query = (queryConfig.id ?
    Object.assign({_id: queryConfig.id}, queryConfig.query || {}) :
    queryConfig.query || {}
  );
  return _getCollection(queryConfig)[method](query, projection);
}

/**
 * Convert results object into array of documents (or just document if one was requested).
 *
 * @private
 * @param {BoltDatabaseQueryConfig} queryConfig       Query config to use.
 * @returns {Array|Object}                            Document(s).
 */
function _getResults(queryConfig) {
  let results = _doQuery(queryConfig, false);
  if (queryConfig.id) return results;
  return (queryConfig.sort ? results.sort(queryConfig.sort).toArray() : results.toArray());
}

/**
 * Get a doc(s) using the given query config instance.
 *
 * @param {BoltDatabaseQueryConfig} queryConfig     Query config to use.
 * @param {boolean} [noFilters=false]               Skip all filtering so it can be done manually.
 * @returns {Array|Object}                          Document(s).
 * @private
 */
function _getDoc(queryConfig, noFilters=false) {
  return _getResults(queryConfig)
    .then(docs=>bolt.makeArray(docs))
    .then(docs=>((queryConfig.filterByAccessLevel && !noFilters) ? docs.filter(doc=>_isAuthorised(doc, queryConfig.session, queryConfig.accessLevel)) : docs))
    .then(docs=>((queryConfig.filterByVisibility && !noFilters) ? docs.filter(doc=>_isAuthorisedVisibility(doc)) : docs))
    .map(doc=>((queryConfig.filterUnauthorisedFields && !noFilters) ? _removeUnauthorisedFields(doc, queryConfig.session, queryConfig.accessLevel) : doc))
    .map(_addCreatedField)
    .map(doc=>(!noFilters ? _removeAddedFields(doc, queryConfig.projection) : doc));
}

/**
 * Added a created field to the doc if it does not exist using the mongo objectId.
 *
 * @private
 * @param {Object}  doc                 The document.
 * @param {Object} [projection={}]      The projection object.
 * @returns {Object}                    The modigfied document.
 */
function _addCreatedField(doc, projection={}) {
  if (projection._created && doc && doc._id) doc._created = new Date(parseInt(doc._id.toString().substring(0, 8), 16) * 1000);
  return doc;
}

/**
 * Perform an insert/update on the given collection usig the data in the query config instance supplied.
 *
 * @pubic
 * @param {BoltDatabaseQueryConfig} _queryConfig    The query config instance.
 * @returns {*}                                     Query result.
 */
function updateDoc(_queryConfig) {
  let queryConfig = _createBoltDatabaseQueryConfig({
    accessLevel: queryConfig.accessLevel || 'edit',
    projection: {_id:true}
  }, _queryConfig);

  let collection = _getCollection(queryConfig);

  if (!queryConfig.query) return collection.insert(queryConfig.doc);
  return _getDoc(queryConfig, true).then(docs=>{
    if (docs.length) {
      return Promise.all(docs.map(doc=>{
        if (!queryConfig.filterByAccessLevel || (queryConfig.filterByAccessLevel && _isAuthorised(doc, queryConfig.session, queryConfig.accessLevel))) {
          let _doc = Object.assign({}, queryConfig.doc, {_acl: doc._acl});
          if (queryConfig.filterUnauthorisedFields) {
            _doc = _removeUnauthorisedFields(_doc, queryConfig.session, queryConfig.accessLevel);
          }
          return collection.update({_id: doc._id}, {$set:_doc});
        }
      }));
    } else {
      return collection.insert(queryConfig.doc);
    }
  });
}

/**
 * Get documents according to given query config.
 *
 * @pubic
 * @param {BoltDatabaseQueryConfig} queryConfig     The query config instance.
 * @returns {*}                                     Docs.
 */
function getDocs(queryConfig) {
  return _getDoc(_createBoltDatabaseQueryConfig(queryConfig));
}

/**
 * Get one document according to given query config.
 *
 * @pubic
 * @param {BoltDatabaseQueryConfig} queryConfig     The query config instance.
 * @returns {*}                                     Doc.
 */
function getDoc(queryConfig) {
  return getDocs(queryConfig)
    .then(docs=>docs.sort(_prioritySorter))
    .then(docs=>docs[0]);
}

/**
 * Remove unauthorised fields in supplied document (in query config) according to query config settngs.
 *
 * @param {BoltDatabaseQueryConfig} queryConfig     Query config to use.
 * @returns {Object}                                The filtered document.
 */
function removeUnauthorisedFields(queryConfig) {
  let _options = _createBoltDatabaseQueryConfig(queryConfig);
  return _removeUnauthorisedFields(_options.doc, _options.session, _options.accessLevel);
}

/**
 * Is the given session user allowed to access the given document (in query config supplied).
 *
 * @param {BoltDatabaseQueryConfig} queryConfig     Query config to use.
 * @returns {boolean}                               Is the user authorised?
 */
function isAuthorised(queryConfig) {
  let _options = _createBoltDatabaseQueryConfig(queryConfig);
  return _getDoc(queryConfig).then(
    doc=>_isAuthorised(doc, _options.session, _options.accessLevel)
  );
}

module.exports = {
  updateDoc,
  getDoc,
  getDocs,
  isAuthorised,
  removeUnauthorisedFields,
  BoltDatabaseQueryConfig
};
