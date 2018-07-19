'use strict';

function injectorReflect(items, component, extraParams, method) {
	const injectors = bolt.get(component, 'req.app.injectors', {});
	return bolt.toObjectMap(items, item=>[item, injectors[item](component, extraParams, method)]);
}

function display(component, extraParams, method) {
	const {isJson, viaView, res, doc, req, view, values, parent} = injectorReflect(
		['isJson', 'viaView', 'res', 'doc', 'req', 'view', 'values', 'parent']
		, component, extraParams, method
	);
	const stringify = (('stringify' in values) ? bolt.toBool(values.stringify, bolt.getDefault('bool.true').concat(undefined, 'undefined')) : true);

	return async (docField, viewName)=> {
		if (isJson) {
			const value = docField ? bolt.get(doc, docField) : doc;
			if (viaView) return (stringify ? JSON.stringify(value) : value);
			return res.json(value);
		}
		const html = await view(viewName, doc, req, parent);
		return viaView ? html : res.send(html);
	};
}

module.exports = display;