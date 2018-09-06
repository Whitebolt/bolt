'use strict';

const MagicString = require('magic-string');
const path = require('path');
const xVarMatch = /.*?var\s*?(\w+)/;


function rollupReactBoltPlugin({reactBoltMap=[]}){
	let componentMap = reactBoltMap;
	if (!Array.isArray(reactBoltMap) && bolt.isObject(reactBoltMap)) {
		componentMap = [];
		Object.keys(reactBoltMap).forEach(key=>{
			componentMap[key] = reactBoltMap[key];
		});
	}
	componentMap = bolt.makeArray(componentMap);

	return {
		transform: function(code, file) {
			const found = componentMap.find(included=>(included.target === file));
			if (!found) return null;

			const magic = new MagicString(code);
			const [fullmatch, varName] = code.match(xVarMatch);
			magic.append(`\nwindow.ReactBolt.${found.name} = (${varName} || {}).default || ${varName};`);
			const map = magic.generateMap({file, source:file});

			return {
				code:magic.toString(),
				map
			}
		}
	};
}

module.exports = rollupReactBoltPlugin;
