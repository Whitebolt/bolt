'use strict';

const SourceListMap = require("source-list-map").SourceListMap;


function rollupReactBoltPlugin(settings){
	return {
		transform: function(code, file){
			const found = (settings.reactBoltMap || []).find(included=>(included.target === file));
			const map = new SourceListMap();
			map.add(code);
			if (found) map.add(`window.ReactBolt.${found.name} = ${found.name}`);

			const sourcemapped = map.toStringWithSourceMap({file});
			return {
				code:sourcemapped.source,
				map:sourcemapped.map
			}
		}
	};
}

module.exports = rollupReactBoltPlugin;
