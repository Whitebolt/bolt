'uses strict';

const {join} = require('path');

async function index(values, res, done, config) {
	// @annotation accepts-connect get
	// @annotation path-map /mode/id


	const root = bolt.chain(bolt.get(config, 'scriptServe', {}))
		.keys()
		.reverse()
		.filter(root=>/^\//.test(root))
		.find(root=>bolt.get(config, `scriptServe[${root}][${values.id}]`, {}))
		.value();

	if (!!root) {
		const {
			path='',
			modes={},
			mimeType='application/javascript'
		} = bolt.get(config, `scriptServe[${root}][${values.id}]`, {});

		if (modes.hasOwnProperty(values.mode)) {
			const filePath = join(root, path, modes[values.mode]);
			res.sendFile(filePath, {
				headers: {
					'Content-Type': mimeType
				}
			});
		}
	}
}

module.exports = {
	index
};