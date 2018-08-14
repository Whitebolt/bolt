'uses strict';

const {createReadStream} = require('fs');
const {Readable} = require('stream');
const {createGzip, createDeflate} = require('zlib');
const noop = require("gulp-noop");

const cache = new Map();


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

function awaitStream(stream) {
	return new Promise((resolve, reject)=>stream
		.on('error', err=>reject(err))
		.on('close', ()=>resolve())
		.on('finish', ()=>resolve())
		.on('end', ()=>resolve())
	);
}

function sendCachedFile(filepath, res) {
	const stream = createFileStream(filepath);
	return awaitStream(stream.pipe(res)).then(()=>cache.get(filepath));
}

function createFileStream(filepath) {
	if (!cache.has(filepath)) return createReadStream(filepath);
	const stream = new Readable();
	stream._read = ()=>{};
	cache.get(filepath).forEach(data=>stream.push(data));
	stream.push(null);
	return stream;
}

function sendFile(filepath, res, req) {
	let encoding = req.acceptsEncodings(['gzip', 'deflate', 'identity']);
	if (encoding === 'deflate' && !!req.acceptsEncodings(['gzip'])) encoding = req.acceptsEncodings(['gzip', 'identity']);

	if ((encoding === 'gzip') || (encoding === 'deflate')) {
		res.setHeader('Content-Encoding', encoding);
		res.removeHeader('Content-Length');
	}
	const compressedPath = ((encoding === 'gzip')?`${filepath}.gz`:((encoding === 'deflate')?`${filepath}.gz`:filepath));
	if (cache.has(compressedPath)) {
		bolt.emit('scriptServeCache', filepath, encoding);
		return sendCachedFile(compressedPath, res);
	}
	const encoder = ((encoding === 'gzip')?createGzip():((encoding === 'deflate')?createDeflate():noop));

	bolt.emit('scriptServe', filepath, encoding);
	const [result, compressed] = [[], []];
	return awaitStream(createFileStream(filepath)
		.on('data', data=>result.push(data))
		.pipe(encoder)
		.on('data', data=>{if (encoder !== noop) compressed.push(data);})
		.pipe(res)
	).then(()=>{
		cache.set(filepath, result);
		if (encoder !== noop) cache.set(compressedPath, compressed);
		return result;
	});
}

async function index(values, res, req, config, query, done) {
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
			await sendFile(mode.path, res, req);
			return done();
		}
	}
}

module.exports = {
	index
};