'use strict';

const serve = require('serve-static');
const defaultOptions = {
	index:false
};

/**
 * Serve static content on all public directories inside root directories.
 *
 * @public
 * @param {BoltApplication} app   The bolt application instance.
 */
function init(app) {
	// @annotation priority

	/**
	 * @todo check if /public exists first
	 */
	bolt.get(app, 'config.root', []).forEach(rootDir=>{
		app.use(serve(`${rootDir}/public/`, {...defaultOptions}));
		app.use(serve(`${rootDir}/upload/`, {...defaultOptions}));

		const moduleServe = bolt.get(app, `config.nodeModulesServe[${rootDir}]`, false);
		if (moduleServe.modules) bolt.makeArray(moduleServe.modules).forEach(moduleName=>{
			app.use(
				`${moduleServe.path || '/lib'}/${moduleName}`,
				serve(`${rootDir}node_modules/${moduleName}`, {...defaultOptions})
			);
		});
	});
}

module.exports = init;
