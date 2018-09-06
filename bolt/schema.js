'use strict';
// @annotation zone server

const NONE = Symbol('No key');

class Triple_Map extends Map {
	delete(key1, key2=NONE, key3=NONE) {
		if (!super.has(key1)) super.set(key1, new Map());
		if (!super.get(key1).has(key2)) super.get(key1).set(key2, new Map());
		return super.get(key1).get(key2).delete(key3);
	}

	get(key1, key2=NONE, key3=NONE) {
		if (!super.has(key1)) super.set(key1, new Map());
		if (!super.get(key1).has(key2)) super.get(key1).set(key2, new Map());
		return super.get(key1).get(key2).get(key3);
	}

	has(key1, key2=NONE, key3=NONE) {
		if (!super.has(key1)) return false;
		if (!super.get(key1).has(key2)) return false;
		return super.get(key1).get(key2).has(key3);
	}

	set(key1, ...params) {
		const [key2, key3, value] = (
			(params.length===3)?params:
				((params.length===2)?[params[0],NONE,params[1]]:[NONE,NONE,params[0]])
		);

		if (!super.has(key1)) super.set(key1, new Map());
		if (!super.get(key1).has(key2)) super.get(key1).set(key2, new Map());
		return super.get(key1).get(key2).set(key3, value);
	}
}

/**
 * @module bolt/bolt
 */

/**
 * Load schemas in given directory into the application.
 *
 * @private
 * @param {string|array.<string>} roots    Path to search for schema directory in and then load hooks from.
 * @param {BoltApplication} app            Object to import into.
 * @returns {Promise.<BoltApplication>}    Promise resolving to application.
 */
async function _loadSchemas(roots, app) {
	const byCollection = new Triple_Map();
	const byName = new Map();
	const lookup = new Map();
	const importObj = {};

	await bolt.importIntoObject({
		roots,
		importObj,
		dirName:'schemas',
		eventName:'loadedSchema'
	});

	bolt(importObj)
		.keys()
		.forEach(schemaId=>lookup.set(schemaId, {
			name: bolt.annotation.get(importObj[schemaId], 'name') || schemaId,
			collection: bolt.annotation.get(importObj[schemaId], 'collection'),
			type: bolt.annotation.get(importObj[schemaId], 'type') || NONE,
			subType: bolt.annotation.get(importObj[schemaId], 'subType') || NONE
		}));

	let fail = -1;
	let currentFail = 0;
	while(fail !== currentFail) {
		fail = currentFail;
		currentFail = 0;
		bolt(importObj)
			.keys()
			.forEach(schemaId=>{
				try {
					const schema = importObj[schemaId](app.schemas);
					const {collection, type, subType, name} = lookup.get(schemaId);
					if (!!collection) byCollection.set(collection, type, subType, schema);
					byName.set(name, schema);
				} catch(err) {
					currentFail++;
				}
			});
	}

	app.schemas = {
		byCollection(collection, type=NONE, subType=NONE) {
			return byCollection.get(collection, type, subType);
		},

		byName(name) {
			return byName.get(name);
		}
	};

	return app;
}

/**
 * Load schemas from schemas directories within the application roots.
 * Filename should be the same as the schemas name.
 *
 * @public
 * @param {BoltApplication} app                       Express application.
 * @param {Array.<string>} [roots=app.locals.roots]   Root folders to search in.
 * @returns {Promise.<BoltApplication>}               Promise resolving to supplied express app after loading of
 *                                                    schemas and firing of related events.
 */
function loadSchemas(app, roots=app.locals.root) {
	return bolt.emitThrough(()=>_loadSchemas(roots, app), 'loadSchemas', app).then(() => app);
}

module.exports = {
	loadSchemas
};