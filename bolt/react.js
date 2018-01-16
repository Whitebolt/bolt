'use strict';
// @annotation browser-export

function initState(instance, ...initiators) {
	instance.state = Object.assign(instance.state || {}, ...bolt.mapReduce(bolt.flatten(initiators), initiator=>{
		const methodName = bolt.camelCase(`get-${initiator}-state`);
		if (methodName in instance) return instance[methodName]();
	}));
}

module.exports = {
	initState
};