'use strict';

function isJson(component, extraParams, method) {
	const injectors = bolt.get(component, 'req.app.injectors', {});
	const req = injectors.req(component);
	const values = injectors.values(component, extraParams, method);
	if (!values.hasOwnProperty('json')) {
		return !!((req.method.toLowerCase() === "post") && req.is('application/json') && req.body)
	} else {
		if (values.json === undefined) return true;
		return bolt.toBool(values.json);
	}
}

module.exports = isJson;