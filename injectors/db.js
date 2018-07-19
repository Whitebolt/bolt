'use strict';

function injectorReflect(items, component, extraParams, method) {
	const injectors = bolt.get(component, 'req.app.injectors', {});
	return bolt.toObjectMap(items, item=>[item, injectors[item](component, extraParams, method)]);
}

function db(component, extraParams, method) {
	const _queryConfig = ()=>injectorReflect(['db', 'app', 'req', 'session'], component, extraParams, method);
	const _getLogicFunction = (funcName, queryConfig={})=>bolt[funcName](Object.assign({}, _queryConfig(), queryConfig));

	const collectionLogic = {
		getDoc: (queryConfig={})=>_getLogicFunction('getDoc', queryConfig),
		getDocs: (queryConfig={})=>_getLogicFunction('getDocs', queryConfig),
		updateDoc: (queryConfig={})=>_getLogicFunction('updateDoc', queryConfig)
	};

	return new Proxy(component.req.app.db, {
		get(target, property, receiver) {
			if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
			if (Reflect.has(collectionLogic, property)) return Reflect.get(collectionLogic, property, receiver);
		}
	});
}

module.exports = db;