'use strict';
// @annotation zone browser server

const _iso639_1 = require('./i18n/iso639_1.json');

let iso639_1Map;

function iso639_1() {
	if (!iso639_1Map) iso639_1Map = new Map(bolt.chain(_iso639_1)
		.keys()
		.map(code=>{
			const name = bolt.chain(_iso639_1[code].name.split(','))
				.map(name=>name.trim())
				.filter(name=>name)
				.value();

			return [
				[code, {..._iso639_1[code], code, name}],
				...name.map(_name=>[_name, {..._iso639_1[code], code, name}])
			];
		})
		.flatten()
		.value()
	);

	return iso639_1Map;
}


module.exports = {
	iso639_1
};
