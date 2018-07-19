'use strict';

function getMethodPath(method) {
	const methodPathParts = bolt.annotation.get(method, 'methodPath').split('/').filter(part=>part);
	const firstIndexPos = methodPathParts.length -  [...methodPathParts].reverse().findIndex(part=>(part!=='index'));
	return '/' + methodPathParts.slice(0, firstIndexPos).join('/');
}

function injectorReflect(items, component, extraParams, method) {
	const injectors = bolt.get(component, 'req.app.injectors', {});
	return bolt.toObjectMap(items, item=>[item, injectors[item](component, extraParams, method)]);
}

function values(component, extraParams, method) {
	const {path, query, body} = injectorReflect(['path', 'query', 'body'], component);
	const _path = component.viaView?component.viaViewPath:path;
	const pathObj = {};
	const pathMap = (bolt.annotation.get(method, 'path-map') || '').split('/').filter(part=>part);

	if (pathMap.length) {
		const methodPath = getMethodPath(method);
		const pathParts = _path.split('?').shift().replace(methodPath, '').split('/').filter(part=>part);
		pathParts.forEach((part, n)=>{
			if (pathMap[n]) pathObj[pathMap[n]] = part;
		})
	}

	return Object.assign({}, query || {}, bolt.getUrlQueryObject(_path) || {}, bolt.isObject(body)?body:{}, pathObj);
}

module.exports = values;