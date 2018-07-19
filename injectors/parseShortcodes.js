'use strict';

function parseShortcodes(component, extraParams, method) {
	const injectors = bolt.get(component, 'req.app.injectors', {});
	return (...params)=>{
		const doc = injectors.doc(component, extraParams, method);
		return bolt.parseShortcodes(component, doc, params);
	}
}

module.exports = parseShortcodes;