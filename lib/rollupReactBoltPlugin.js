'use strict';

function rollupReactBoltPlugin(){
	return {
		transform: function(code, id){
			if (bolt.__react.has(id)) {
				const exports = require(id);
				if (bolt.annotation.get(exports, 'browser-export') !== false) {
					const name = exports.default.name;
					code += `ReactBolt.${name} = ${name}`;
				}
			}
			return {
				code,
				map: { mappings: '' }
			}
		}
	};
}

module.exports = rollupReactBoltPlugin;
