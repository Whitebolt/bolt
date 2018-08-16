'uses strict';

const {createGzip, createDeflate} = require('zlib');
const createBrotli = require('iltorb').compressStream;
const noop = require("gulp-noop");


function awaitStream(stream) {
	return new Promise((resolve, reject)=>stream
		.on('error', err=>reject(err))
		.on('close', ()=>resolve())
		.on('finish', ()=>resolve())
		.on('end', ()=>resolve())
	);
}

function sendCachedFile(filepath, res, encoding) {
	bolt.emit('scriptServeCache', filepath, encoding);
	const stream = bolt.readFile(filepath, {stream:true});
	return awaitStream(stream.pipe(res)).then(()=>bolt.readFile.cache.get(filepath));
}

function sendFile(filepath, res, req) {
	let encoding = req.acceptsEncodings(['br', 'gzip', 'deflate', 'identity']);
	if (encoding === 'deflate' && !!req.acceptsEncodings(['gzip'])) encoding = req.acceptsEncodings(['gzip', 'identity']);
	if (encoding !== 'br' && !!req.acceptsEncodings(['br'])) encoding = req.acceptsEncodings(['br', 'identity']);

	if ((encoding === 'gzip') || (encoding === 'deflate') || (encoding === 'br')) {
		res.setHeader('Content-Encoding', encoding);
		res.removeHeader('Content-Length');
	}

	const compressedPath = ((encoding === 'identity')?`${filepath}`:((encoding === 'gzip')?`${filepath}.gz`:`${filepath}.${encoding}`));
	if (bolt.readFile.cache.has(compressedPath)) return sendCachedFile(compressedPath, res, encoding);
	const encoder = ((encoding === 'gzip')?createGzip():((encoding === 'deflate')?createDeflate():((encoding === 'br') ? createBrotli() : n)));

	bolt.emit('scriptServe', filepath, encoding);
	const compressed = [];
	return awaitStream(bolt.readFile(filepath, {stream:true})
		.pipe(encoder).on('data', data=>{if (encoder !== noop) compressed.push(data);})
		.pipe(res)
	).then(()=>{
		if (encoder !== noop) bolt.readFile.cache.set(compressedPath, [null, compressed]);
		return bolt.readFile.cache.get(filepath)[1];
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
	const script = await bolt.scriptServer.getScript({allowedModes, modes, mode:values.mode});
	if (!!script) {
		res.set('Content-Type', script.mimetype);
		await sendFile(script.path, res, req);
		return done();
	}
}

module.exports = {
	index
};