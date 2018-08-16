'use strict';
// @annotation zone server

const getModes = bolt.memoize2(function getModes(mode, modes, allowedModes) {
	const modeIndex = allowedModes.indexOf(mode);
	return bolt([
		mode,
		...allowedModes.slice(0, modeIndex).reverse(),
		...allowedModes.slice(modeIndex+1)
	])
		.filter(allowedMode=>modes.hasOwnProperty(allowedMode))
		.map(allowedMode=>modes[allowedMode])
		.value();
}, {cacheParams:2});

async function getScript({
	config={},
	id,
	mode='production',
	allowedModes=bolt.get(config, 'modes', []),
	modes=bolt.get(config, `scriptServe['${id}']`, {})
}) {
	const possibleModes = getModes(mode, modes, allowedModes);

	let index = -1;
	const length = ((possibleModes == null) ? 0 : possibleModes.length);
	while(++index < length) {
		const script = possibleModes[index];
		const found = await bolt.isFile(script.path);
		if (found) return script;
	}
}

async function _getDeps(options) {
	return bolt.get((await getScript(options)) || {}, 'deps', []);
}

async function getScriptDeps({
	config={},
	id,
	mode='production',
	allowedModes=bolt.get(config, 'modes', []),
	modes=bolt.get(config, `scriptServe['${id}']`, {})
}) {
	const current = await _getDeps({config, mode, id, allowedModes, modes});
	const all = await Promise.all(bolt(current)
		.makeArray()
		.map(async (id)=>[...(await getScriptDeps({config, mode, id, allowedModes})), id])
		.value()
	);

	return bolt(all).flattenDeep().uniq().value();
}

async function _getScriptLoaderData({config, scripts=[], mode}) {
	const all = await Promise.all(bolt(scripts)
		.makeArray()
		.map(async (script)=>{
			const deps = await Promise.all((await getScriptDeps({config, mode, id:script.id}))
				.map(async (dep)=>{
					const id = (bolt.isString(dep)?dep:dep.id);
					const script = await getScript({config, mode, id});
					return {
						id,
						async: (script.hasOwnProperty('async')?script.async:false),
						defer: (script.hasOwnProperty('defer')?script.defer:true)
					};
				})
			);

			return [...deps, script];
		})
		.value()
	);

	return bolt(all).flattenDeep().value();
}

const getScriptLoaderData = bolt.memoize2(_getScriptLoaderData, {
	type:'promise',
	cacheParams:2,
	resolver:({mode, scripts})=>[mode, scripts]
});

module.exports = {
	scriptServer: {
		getScriptLoaderData, getScriptDeps, getScript, getModes
	}
};