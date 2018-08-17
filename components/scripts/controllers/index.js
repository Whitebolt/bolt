'uses strict';

const {createGzip, createDeflate} = require('zlib');
const createBrotli = require('iltorb').compressStream;
const noop = require("gulp-noop");
const {join} = require('path');


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

async function sendFile(filepath, res, req) {
	let encoding = req.acceptsEncodings(['br', 'gzip', 'deflate', 'identity']);
	if (encoding === 'deflate' && !!req.acceptsEncodings(['gzip'])) encoding = req.acceptsEncodings(['gzip', 'identity']);
	if (encoding !== 'br' && !!req.acceptsEncodings(['br'])) encoding = req.acceptsEncodings(['br', 'identity']);

	res.setHeader('Cache-Control', 'max-age=31556926');
	if ((encoding === 'gzip') || (encoding === 'deflate') || (encoding === 'br')) {
		res.setHeader('Content-Encoding', encoding);
		res.removeHeader('Content-Length');
	}

	const compressedPath = ((encoding === 'identity')?`${filepath}`:((encoding === 'gzip')?`${filepath}.gz`:`${filepath}.${encoding}`));
	if (bolt.readFile.cache.has(compressedPath)) return sendCachedFile(compressedPath, res, encoding);
	const cachePath = join(bolt.getCacheDir(req.app), compressedPath);
	if ((await bolt.isFile(cachePath)) && (await bolt.isFile(filepath))) {
		if ((await bolt.stat(cachePath)).mtimeMs > (await bolt.stat(filepath)).mtimeMs) {
			const [err, content] = await sendCachedFile(cachePath, res, encoding);
			bolt.readFile.cache.set(compressedPath, [err, content]);
			return content;
		}
	}

	const encoder = ((encoding === 'gzip')?createGzip():((encoding === 'deflate')?createDeflate():((encoding === 'br') ? createBrotli() : n)));

	bolt.emit('scriptServe', filepath, encoding);
	const compressed = [];
	return awaitStream(bolt.readFile(filepath, {stream:true})
		.pipe(encoder).on('data', data=>{if (encoder !== noop) compressed.push(data);})
		.pipe(res)
	).then(()=>{
		if (encoder !== noop) {
			bolt.readFile.cache.set(compressedPath, [null, compressed]);
			bolt.writeFile(cachePath, Buffer.concat(compressed), {createDirectories:true})
		}
		return bolt.readFile.cache.get(filepath)[1];
	});
}

async function index(values, res, req, config, done) {
	// @annotation accepts-connect get
	// @annotation path-map /mode/id/filename

	const allowedModes = bolt.get(config, 'modes', []);
	if (bolt.objectLength(values.__pathObj) === 2) {
		if (!values.filename) {
			values.id = values.__pathObj.mode;
			values.filename = values.__pathObj.id;
		}
	}
	const modes = bolt.get(config, `scriptServe['${values.id}']`, {});
	const script = await bolt.scriptServer.getScript({allowedModes, modes, mode:values.mode, filename:values.filename});
	if (!!script) {
		res.set('Content-Type', script.mimetype);
		const filepath = bolt.get(script, `resources['${values.filename}']`, script.path);
		await sendFile(filepath, res, req);
		return done();
	}
}

module.exports = {
	index
};