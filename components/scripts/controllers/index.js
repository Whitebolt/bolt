'uses strict';

const {createReadStream} = require('fs');
const {Readable} = require('stream');
const cache = new Map();


const getModes = bolt.memoize(function getModes(mode, modes, allowedModes) {
	const modeIndex = allowedModes.indexOf(mode);
	return bolt([
		mode,
		...allowedModes.slice(0, modeIndex).reverse(),
		...allowedModes.slice(modeIndex+1)
	])
		.filter(allowedMode=>modes.hasOwnProperty(allowedMode))
		.map(allowedMode=>modes[allowedMode])
		.value();
});

function awaitStream(stream) {
	return new Promise((resolve, reject)=>stream
		.on('error', err=>reject(err))
		.on('close', ()=>resolve())
		.on('finish', ()=>resolve())
		.on('end', ()=>resolve())
	);
}

function sendCachedFile(filepath, res) {
	bolt.emit('scriptServeCache', filepath);
	const stream = new Readable();
	stream._read = () => {}; // redundant? see update below
	stream.push(cache.get(filepath));
	stream.push(null);
	return awaitStream(stream.pipe(res)).then(()=>cache.get(filepath));
}

function sendFile(filepath, res) {
	if (cache.has(filepath)) return sendCachedFile(filepath, res);

	bolt.emit('scriptServe', filepath);
	const result = [];
	return awaitStream(createReadStream(filepath).on('data', data=>result.push(data)).pipe(res))
		.then(()=>result.map(result=>result.toString()).join())
		.then(result=>{
			cache.set(filepath, result);
			return result;
		});
}

async function index(values, res, config, query, done) {
	// @annotation accepts-connect get
	// @annotation path-map /mode/id

	const allowedModes = bolt.get(config, 'modes', []);
	if (bolt.objectLength(values.__pathObj) === 1) {
		if (!values.id) values.id = values.__pathObj.mode;
		if (!query.mode) values.mode = allowedModes[allowedModes.length-1];
	}
	const modes = bolt.get(config, `scriptServe['${values.id}']`, {});
	const possibleModes = getModes(values.mode, modes, allowedModes);

	let index = -1;
	const length = ((possibleModes == null) ? 0 : possibleModes.length);
	while(++index < length) {
		const mode = possibleModes[index];
		const found = await bolt.isFile(mode.path);
		if (found) {
			res.set('Content-Type', mode.mimetype);
			await sendFile(mode.path, res);
			return done();


			/*return res.sendFile(mode.path, {
				headers: {
					'Content-Type': mode.mimetype
				}
			});*/
		}
	}
}

module.exports = {
	index
};