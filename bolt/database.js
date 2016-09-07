'use strict';

const Promise = require('bluebird');
const mongo = require('mongodb');
const mysql = require('mysql');
const rrulestr = require('rrule').rrulestr;
const dateParser = require('ical-date-parser');

const loaders = {
	mongodb: loadMongo,
	mysql: loadMysql
};

function createMongoUrl(options) {
	options.server = options.server || 'localhost';
	options.port = options.port || 27017;

	return `mongodb://${createMongoAuthenticationPart(options)}${options.server}:${options.port}/${options.database}${options.username ? '?authSource=' + options.adminDatabase : ''}`
}

function createMongoAuthenticationPart(options) {
	if (options.username) {
		options.adminDatabase = options.adminDatabase || 'admin';
		return encodeURIComponent(options.username)
			+ (options.password ? ':' + encodeURIComponent(options.password) : '')
			+ '@';
	}

	return '';
}

function loadMongo(options) {
	return mongo.MongoClient.connect(createMongoUrl(options), {
		uri_decode_auth: true,
		promiseLibrary: Promise
	}).then(results => {
    if (global.bolt && bolt.fire) bolt.fire('mongoConnected', options.database);
		return results;
	})
}

function loadMysql(options) {
	return new Promise(function(resolve, reject) {
		let database = mysql.createConnection({
			host     : options.server,
			user     : options.username,
			password : options.password,
			database : options.database
		});
		database.connect();
    bolt.fire('SQLConnected', options.database);
		resolve(database);
	});
}

function _loadDatabases(app, config=app.config.databases) {
	app.dbs = app.dbs || {};
	let databases = Object.keys(config);

	return Promise.all(databases.map(dbName => {
		let options = config[dbName];
		let loader = loaders[options.type];

		return loader(options).then(database => {
			app.dbs[dbName] = database;
			if (options.default) {
				app.db = database;
			}
		});
	})).then(() => app);
}

/**
 * Get a mongo id for the given id value.
 *
 * @public
 * @param {*} id        Value, which can be converted to a mongo-id.
 * @returns {Object}    Mongo-id object.
 */
function mongoId(id) {
	return new mongo.ObjectID(id);
}

function loadDatabases(app) {
	return bolt.fire(()=>_loadDatabases(app), 'loadDatabases', app).then(() => app);
}

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
  if (options.id) options.id = mongoId(options.id);
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

function _getDoc(options) {
  if (options.id) {
    let query = Object.assign({_id: options.id}, options.query || {});
    return options.db.collection(options.collection).findOne(query, options.projection);
  } else {
    return options.db.collection(options.collection).find(options.query, options.projection).toArray();
  }
}

function getDocs(options) {
  let _options = _parseOptions(options);

  return _getDoc(_options).then(docs=>bolt.makeArray(docs))
}

function getDoc(options) {
  let _options = _parseOptions(options);

  return _getDoc(_options)
    .then(docs=>bolt.makeArray(docs))
    .then(docs=>
      (options.filterByAccessLevel ? docs.filter(doc=>_isAuthorised(doc, _options.session, _options.accessLevel)) : docs)
    )
    .then(docs=>
      (options.filterByVisibility ? docs.filter(doc=>_isAuthorisedVisibility(doc)) : docs)
    )
    .then(docs=>docs.sort(_prioritySorter))
    .then(docs=>
      (options.filterUnauthorisedFields ? _removeUnauthorisedFields(docs[0], _options.session, _options.accessLevel) : docs[0])
    )
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
	loadDatabases, mongoId, getDoc, getDocs, loadMongo, isAuthorised, removeUnauthorisedFields
};