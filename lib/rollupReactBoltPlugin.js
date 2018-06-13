'use strict';

function rollupReactBoltPlugin(){
	return {
		transform: function(code, id){
			const found = (settings.reactBoltMap || []).find(included=>(included.target === id));
			if (found) code += `window.ReactBolt.${found.name} = ${found.name}`;
			return {
				code
			}
		}
	};
}

module.exports = rollupReactBoltPlugin;
