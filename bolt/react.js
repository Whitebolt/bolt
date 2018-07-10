'use strict';
// @annotation zone browser server

function initState(instance, ...initiators) {
	const _initiators = bolt.chain(initiators)
		.flatten()
		.map(initiator=>{
			const methodName = bolt.camelCase(`get-${initiator}-state`);
			if (methodName in instance) return instance[methodName]();
		})
		.filter(value=>(value !== undefined))
		.value();

	instance.state = Object.assign(instance.state || {}, ..._initiators);
}

module.exports = {
	initState
};