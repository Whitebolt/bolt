'use strict';

const through = require('through2');
const destroy = require('destroy');

function streamToPromise(stream, exporter) {
	return new Promise((resolve, reject)=>{
		stream
			.on('end', ()=>{
				stream.emit('close');
				destroy(stream);
				resolve(exporter);
			})
			.on('error', error=>{
				destroy(stream);
				reject(error);
			});
	});
}

function extractVinyl(extractFunc) {
	return through.obj(function (file, encoding, callback) {
		extractFunc.call(this, file, encoding);
		return callback(null, file);
	});
}


module.exports = {
	streamToPromise, extractVinyl
};