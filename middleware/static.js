'use strict';

const path = require('path');
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

	const publicDirs = [path.join('private', app.locals.name||'unknown'), 'public', 'upload'];
	const exportedModules = new Set();

	bolt.chain(bolt.get(app, 'locals.root', []))
		.map(root=>publicDirs.map(publicDir=>{
			const dirToServe = path.join(root, publicDir);
			if (bolt.fileExistsSync(dirToServe)) return ['/', dirToServe];
		}))
		.flatten()
		.filter(dir=>dir)
		.forEach(([mountPath, dirPath])=>{
			app.use(mountPath, serve(dirPath, {...defaultOptions}));
			bolt.emit('mountFilesystem', dirPath, mountPath);
		})
		.value();

	bolt.chain(bolt.get(app, `locals.nodeModulesServe`, {}))
		.keys()
		.reverse()
		.map(root=>{
			const moduleServe = app.locals.nodeModulesServe[root];
			if (moduleServe.modules) return bolt.makeArray(moduleServe.modules).map(_moduleName=>{
				const [moduleName, serveAs=_moduleName] = _moduleName.split(':');
				const servePath = path.join(moduleServe.path || 'lib', serveAs);
				const lookup = `${servePath}:${moduleName}`;
				if (!exportedModules.has(lookup)) {
					const dirToServe = path.join(root, 'node_modules', moduleName);
					if (bolt.fileExistsSync(dirToServe)) {
						exportedModules.add(lookup);
						return [servePath, dirToServe];
					}
				}
			});
		})
		.flatten()
		.filter(dir=>dir)
		.forEach(([mountPath, dirPath])=>{
			app.use(mountPath, serve(dirPath, {...defaultOptions}));
			bolt.emit('mountFilesystem', dirPath, mountPath);
		})
		.value();
}

module.exports = init;
