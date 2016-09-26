'use strict';

const rrulestr = require('rrule').rrulestr;
const dateParser = require('ical-date-parser');

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

function _getAccessGroups(session) {
  let ids = (session.groups || []).map(group=>group._id).filter(id=>id);
  if (session && session.passport && session.passport.user) ids.unshift(session.passport.user);
  return ids;
}

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

function _isAuthorised(doc, session, accessLevel) {
  if (!doc) return false;
  if (!doc._acl) return false;
  if (!doc._acl.security) return false;

  let authorisedIds = _getAccessLevelLookup(doc._acl, accessLevel.toLowerCase().trim());
  if (authorisedIds.length) {
    let groupIds = _getAccessGroups(session);
    return _idIsInGroup(groupIds, authorisedIds);
  }

  return false;
}

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

function _parseOptions(options) {
  options.accessLevel = options.accessLevel || 'read';
  options.collection = options.collection || 'pages';
  options.app = ((options.req && !options.app) ? options.req.app : options.app);
  options.db = ((bolt.isString(options.db) && options.app) ? options.app.dbs[options.db] : options.db);
  options.db = ((!options.db && options.app) ? options.app.db : options.db);
  options.session = options.session || (options.req ? options.req.session : {});
  if (options.id) options.id = bolt.mongoId(options.id);
  if (Array.isArray(options.projection)) {
    let temp = {};
    options.projection.forEach(key=>{temp[key] = true;});
    options.projection = temp;
  }
  if (!options.hasOwnProperty('filterByVisibility')) options.filterByVisibility = true;
  if (!options.hasOwnProperty('filterByAccessLevel')) options.filterByAccessLevel = true;
  if (!options.hasOwnProperty('filterUnauthorisedFields')) options.filterUnauthorisedFields = true;

  return options;
}

function _prioritySorter(a, b) {
  return bolt.prioritySorter({priority: a._priority}, {priority: b._priority});
}

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

function _removeAddedFields(doc, projection={}) {
  if (!projection._acl) delete doc._acl;
  if (!projection._id) delete doc._id;
  return doc;
}

function _getDoc(options) {
  let getDoc;
  let projection = (options.projection ?
    Object.assign({}, options.projection, {'_acl':true, '_id':true}) :
    undefined
  );
  if (options.id) {
    let query = Object.assign({_id: options.id}, options.query || {});
    getDoc = options.db.collection(options.collection).findOne(query, projection);
  } else {
    getDoc = options.db.collection(options.collection).find(options.query, projection).toArray();
  }

  return getDoc
    .then(docs=>bolt.makeArray(docs))
    .then(docs=>(options.filterByAccessLevel ? docs.filter(doc=>_isAuthorised(doc, options.session, options.accessLevel)) : docs))
    .then(docs=>(options.filterByVisibility ? docs.filter(doc=>_isAuthorisedVisibility(doc)) : docs))
    .map(doc=>(options.filterUnauthorisedFields ? _removeUnauthorisedFields(doc, options.session, options.accessLevel) : doc))
    .map(_addCreatedField)
    .map(doc=>_removeAddedFields(doc, options.projection));
}

function getDocs(options) {
  let _options = _parseOptions(options);

  return _getDoc(_options);
}

function _addCreatedField(doc, projection={}) {
  if (projection._created && doc && doc._id) doc._created = new Date(parseInt(doc._id.toString().substring(0, 8), 16) * 1000);
  return doc;
}

function getDoc(options) {
  let _options = _parseOptions(options);

  return _getDoc(_options)
    .then(docs=>docs.sort(_prioritySorter))
    .then(docs=>docs[0]);
}

function removeUnauthorisedFields(options) {
  let _options = _parseOptions(options);
  return _removeUnauthorisedFields(_options.doc, _options.session, _options.accessLevel);
}

function isAuthorised(options) {
  let _options = _parseOptions(options);
  return _getDoc(options).then(
    doc=>_isAuthorised(doc, _options.session, _options.accessLevel)
  );
}

module.exports = {
  getDoc,
  getDocs,
  isAuthorised,
  removeUnauthorisedFields
};
