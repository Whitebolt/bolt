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

function wrapComponent({compose, MaterialUi}, ...components) {
	const component = components.pop();
	if (!!MaterialUi && !!component.styles && !components.find(component=>(component === MaterialUi.withStyles))) {
		components.push(MaterialUi.withStyles(component.styles));
	}
	const Wrapped = compose(...components)(component);
	function Component(props) {
		return React.createElement(Wrapped, props);
	}
	Component.displayName = component.displayName || component.name;
	return Component;
}

module.exports = {
	initState, wrapComponent
};