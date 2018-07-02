'use strict';

//const SourceListMap = require("source-list-map").SourceListMap;
const MagicString = require('magic-string');


function rollupReactBoltPlugin(settings){
	return {
		transform: function(code, file){
			const found = (settings.reactBoltMap || []).find(included=>(included.target === file));
			if (!found) return null;

			console.log(file);
			const magic = new MagicString(code);
			magic.append(`\nwindow.ReactBolt.${found.name} = ${found.name};`);
			const map = magic.generateMap({file, source:file});

			return {
				code:magic.toString(),
				map
			}
		}
	};
}

module.exports = rollupReactBoltPlugin;
