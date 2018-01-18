'use strict';

/**
 * @module bolt/bolt
 */

const path = require('path');
const util = require('util');
const Nginx = require('nginx-o');

/**
 * Load all nginx templates from nginx directories
 *
 * @private
 * @param {Array|string} roots    The root folders to search for nginx
 *                                folders in.
 * @returns {Promise}             Promise resolving gto the templates.
 */
async function _loadNginxTemplates(roots, siteConfig) {
	const config = addSslBlock(Object.assign({boltRootDir}, siteConfig));
	const nginxDirs = await bolt.directoriesInDirectory(roots, 'nginx');
	const templateFileNames = await bolt.filesInDirectory(nginxDirs, ['conf']);
	return Object.assign(...await Promise.all(templateFileNames.map(async (templateFileName)=>{
		const template = bolt.runTemplate(await bolt.fs.readFile(templateFileName), config);
		return {[path.basename(templateFileName, '.conf')]: template};
	})));
}

function addSslBlock(config) {
	if (config.sslServerKey && config.sslServerCrt) {
		config.sslBlock = `
			ssl_certificate ${config.sslServerCrt};
			ssl_certificate_key ${config.sslServerKey};
			ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
			ssl_prefer_server_ciphers off;
		`;
	} else {
		config.sslBlock = '';
	}
	return config;
}

/**
 * Get a new nginx controller instance and setup some reporting on this.
 *
 * @todo  Expand the reporting
 *
 * @returns {Nginx}   Nginx controller instance.
 */
function getNginx() {
	const nginx = new Nginx();
	nginx.on('started', ()=>console.log('nginx has started'));
	nginx.on('stopped', ()=>console.log('nginx has stopped'));
	return nginx;
}

/**
 * Create a symlink, catching and handling errors and ensure a new link is
 * created replacing any old links.
 *
 * @private
 * @param {string} from   Where the link points to.
 * @param {string} to     The symlink file.
 * @returns {Promise}     Promise resolving when the operation is complete.
 */
function _symlinker(from, to) {
	let tempSymLinker = ()=>bolt.fs.symlink(from, to+'_TEMP');

	return tempSymLinker().then(
		value=>value,
		err=>{
			if (err && err.code && (err.code.toUpperCase() === 'EEXIST')) return bolt.fs.unlink(to+'_TEMP').then(tempSymLinker);
			throw err;
		}
	).then(
		()=>bolt.fs.rename(to+'_TEMP', to)
	)
}

/**
 * Launch nginx for a given site
 *
 * @private
 * @param {string} siteName                         The site name to launch.
 * @param {Object} siteConfig                       The main config.
 * @param {Object} nginxTemplates                   The ejs template.
 * @param {Object} [nginxConfig=siteConfig.nginx]   The nginx section of the main config.
 */
async function _launchNginx(siteName, siteConfig, nginxTemplates, nginxConfig=siteConfig.nginx) {
	const nginx = getNginx();
	const siteAvailable = nginxConfig.sitesAvailable + siteName;
	const siteEnabled = nginxConfig.sitesEnabled + siteName;

	await bolt.fs.writeFile(
		siteAvailable,
		nginxTemplates[nginxConfig.template],
		{flags:'w', encoding:'utf-8'}
	);
	await _symlinker(siteAvailable, siteEnabled);
	await nginx.reload();
}

/**
 * Launch nginx for given site config.
 *
 * @public
 * @param {Object} siteConfig   The site config.
 * @returns {Promise}           Promise resolving when nginx reloaded with site running.
 */
async function launchNginx(siteConfig) {
	const roots = siteConfig.root;
	const siteName = (siteConfig.shortName || siteConfig.userName);
	const nginxConfig = siteConfig.nginx;
	const nginxTemplates = await _loadNginxTemplates(roots, siteConfig);

	if (nginxConfig && nginxConfig.template && nginxTemplates[nginxConfig.template]) {
		await _launchNginx(siteName, siteConfig, nginxTemplates, nginxConfig)
	}
	return siteConfig;
}

module.exports = {
	launchNginx
};