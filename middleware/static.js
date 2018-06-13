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
	// @annotation priority 10

	/**
	 * @todo check if /public exists first
	 */
	bolt.get(app, 'config.root', []).forEach(rootDir=>{
		app.use(serve(`${rootDir}/private/${app.config.name||'unknown'}`, {...defaultOptions}));
		app.use(serve(`${rootDir}/public/`, {...defaultOptions}));
		app.use(serve(`${rootDir}/upload/`, {...defaultOptions}));
	});

	bolt.chain(bolt.get(app, `config.nodeModulesServe`, {}))
		.keys()
		.forEach(rootDir=>{
			const moduleServe = app.config.nodeModulesServe[rootDir];
			if (moduleServe.modules) bolt.makeArray(moduleServe.modules).forEach(moduleName=>{
				app.use(
					`${moduleServe.path || '/lib'}/${moduleName}`,
					serve(`${rootDir}node_modules/${moduleName}`, {...defaultOptions})
				);
			});
		})
		.value()
}

module.exports = init;
