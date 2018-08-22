'use strict';
// @annotation zone server

const {basename} = require('path');

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
	modes=bolt.get(config, `scriptServe['${id}']`, {}),
	filename,
	deps=[]
}) {
	const possibleModes = getModes(mode, modes, allowedModes);

	let index = -1;
	const length = ((possibleModes == null) ? 0 : possibleModes.length);
	while(++index < length) {
		const script = {...possibleModes[index]};
		const found = await (!!filename ?
			bolt.isFile(script.resources[filename] || script.path) :
			bolt.isFile(script.path)
		);
		if (found) {
			script.deps = bolt.uniq([...bolt.makeArray(script.deps), ...bolt.makeArray(deps)]);
			return script;
		}
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

async function getLoaderScript(script, mode) {
	try {
		const _script = {
			filename: basename(script.path),
			id: script.id,
			cacheId: parseInt((await bolt.stat(script.path)).mtimeMs, 10),
			async: (script.hasOwnProperty('async')?script.async:true),
			defer: (script.hasOwnProperty('defer')?script.defer:false),
			deps: bolt.makeArray(script.deps)
		};
		_script.browserPath = `/scripts/${mode || script.mode}/${script.id}/${_script.filename}`;
		return _script;
	} catch(err) {
		console.error(err);
	}
}

async function _getScriptLoaderData({config, scripts=[], mode}) {
	const all = await Promise.all(bolt(scripts)
		.makeArray()
		.map(async (script)=>{
			const deps = await Promise.all((await getScriptDeps({config, mode, id:script.id}))
				.map(async (dep)=>{
					const id = (bolt.isString(dep)?dep:dep.id);
					const script = {...(await getScript({config, mode, id})), id};
					return await getLoaderScript(script, mode);
				})
			);

			const _script = {...(await getScript({config, mode, id:script.id, deps:script.deps})), id:script.id};
			return [...deps, await getLoaderScript(_script, mode)];
		})
		.value()
	);

	const deps = new Set();
	return bolt(all)
		.flattenDeep()
		.filter(item=>{
			if (!item) return false;
			const lookup = `${item.id}/${item.filename}`;
			if (deps.has(lookup)) return false;
			deps.add(lookup);
			return true;
		})
		.value();
}

const getScriptLoaderData = bolt.memoize2(_getScriptLoaderData, {
	type:'promise',
	cacheParams:2,
	resolver:({mode, scripts})=>[mode, scripts]
});

module.exports = {
	scriptServer: {
		getScriptLoaderData, getScriptDeps, getScript, getModes, getLoaderScript
	}
};