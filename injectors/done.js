'use strict';

function done(component) {
	return (status=(component.res.statusCode || 200), message)=> {
		component.done = !!status;
		if (!bolt.isNaN(status)) component.res.statusCode = status;
		if (!!message) {
			if (bolt.isString(message)) {
				component.res.statusMessage = message;
			} else if (bolt.isObject(message)) {
				component.res.locals.doc = component.res.locals.doc || {};
				Object.assign(component.res.locals.doc, message);
				component.sendFields = [...(component.sendFields || []), ...Object.keys(component.res.locals.doc)];
			}
		}
	}
}

module.exports = done;