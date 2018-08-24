'uses strict';

const {createGzip, createDeflate} = require('zlib');
const createBrotli = require('iltorb').compressStream;
const noop = require("gulp-noop");
const {join} = require('path');
const mime = require('mime');


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

async function sendFile(filepath, res, req, query) {
	let encoding = req.acceptsEncodings(['br', 'gzip', 'deflate', 'identity']);
	if (encoding === 'deflate' && !!req.acceptsEncodings(['gzip'])) encoding = req.acceptsEncodings(['gzip', 'identity']);
	if (encoding !== 'br' && !!req.acceptsEncodings(['br'])) encoding = req.acceptsEncodings(['br', 'identity']);

	if (!!query.cacheId && !query.noCache) res.setHeader('Cache-Control', 'max-age=31556926');
	if ((encoding === 'gzip') || (encoding === 'deflate') || (encoding === 'br')) {
		//res.setHeader('Content-Encoding', encoding);
		//res.removeHeader('Content-Length');
	}

	const compressedPath = ((encoding === 'identity')?`${filepath}`:((encoding === 'gzip')?`${filepath}.gz`:`${filepath}.${encoding}`));
	const cachePath = join(bolt.getCacheDir(req.app), compressedPath);
	/*if (!query.noCache) {
		if (bolt.readFile.cache.has(compressedPath)) return sendCachedFile(compressedPath, res, encoding);
		if ((await bolt.isFile(cachePath)) && (await bolt.isFile(filepath))) {
			if ((await bolt.stat(cachePath)).mtimeMs > (await bolt.stat(filepath)).mtimeMs) {
				const [err, content] = await sendCachedFile(cachePath, res, encoding);
				bolt.readFile.cache.set(compressedPath, [err, content]);
				return content;
			}
		}
	}*/

	// @todo We have turne off compression for the moment as slows it down.  Need to refactor
	// with WebWorker and saving next to files.

	const encoder = ((encoding === 'gzip')?createGzip():((encoding === 'deflate')?createDeflate():((encoding === 'br') ? createBrotli() : n)));

	bolt.emit('scriptServe', filepath, encoding);
	const compressed = [];
	return awaitStream(bolt.readFile(filepath, {stream:true, noCache:!!query.noCache})
		//.pipe(encoder).on('data', data=>{if (encoder !== noop) compressed.push(data);})
		.pipe(res)
	).then(()=>{
		if (encoder !== noop) {
			bolt.readFile.cache.set(compressedPath, [null, compressed]);
			bolt.writeFile(cachePath, Buffer.concat(compressed), {createDirectories:true})
		}
		if (bolt.readFile.cache.has(filepath)) return bolt.readFile.cache.get(filepath)[1];
	});
}

async function index(values, res, req, config, done, query) {
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
	const script = await bolt.scriptServer.getScript({
		allowedModes,
		modes,
		mode:values.mode,
		filename:values.filename,
		noCache: bolt.toBool(query.noCache)
	});
	if (!!script) {
		if (bolt.has(script, `resources['${values.filename}']`)) {
			const filepath = bolt.get(script, `resources['${values.filename}']`, script.path);
			res.set('Content-Type', mime.getType(filepath));
			await sendFile(filepath, res, req, query);
		} else {
			res.set('Content-Type', script.mimetype);
			await sendFile(script.path, res, req, query);
		}
		return done();
	}
}

module.exports = {
	index
};