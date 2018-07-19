'use strict';

function done(component) {
	return (status=200, message)=> {
		component.done = !!status;
		if (!bolt.isNaN(status)) component.res.statusCode = status;
		if (!!message) {
			if (bolt.isString(message)) {
				component.res.statusMessage = message;
			} else if (bolt.isObject(message)) {
				component.req.doc = component.req.doc || {};
				Object.assign(component.req.doc, message);
				component.sendFields = [...(component.sendFields || []), ...Object.keys(component.req.doc)];
			}
		}
	}
}

module.exports = done;