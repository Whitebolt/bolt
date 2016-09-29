'use strict';

const Promise = require('bluebird');
const fs = require('fs');
const writeFile = Promise.promisify(fs.writeFile);
const symLink = Promise.promisify(fs.symlink);
const unlink = Promise.promisify(fs.unlink);
const rename = Promise.promisify(fs.rename);
const Nginx = require('nginx-o');

/**
 * Load all nginx templates from nginx directories
 *
 * @private
 * @param {Array|string} roots    The root folders to search for nginx
 *                                folders in.
 * @returns {Promise}             Promise resolving gto the templates.
 */
function _loadNginxTemplates(roots) {
  return bolt.loadEjsDirectory(roots, 'nginx', {
    locals: false,
    localsName: ['config']
  });
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
 * Apply a nginx template.
 *
 * @private
 * @param {Object} siteConfig                       The main config.
 * @param {Object} nginxTemplates                   The ejs template.
 * @param {Object} [nginxConfig=siteConfig.nginx]   The nginx section of the
 *                                                  main config.
 * @returns {Promise}                               Promise resolving to the
 *                                                  template result string.
 */
function _applyTemplate(siteConfig, nginxTemplates, nginxConfig=siteConfig.nginx) {
  return nginxTemplates[nginxConfig.template].compiled(siteConfig)
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
  let tempSymLinker = ()=>symLink(from, to+'_TEMP');

  return tempSymLinker().then(
    value=>value,
    err=>{
      if (err && err.code && (err.code.toUpperCase() === 'EEXIST')) return unlink(to+'_TEMP').then(tempSymLinker);
      throw err;
    }
  ).then(
    ()=>rename(to+'_TEMP', to)
  )
}

/**
 * Launch nginx for a given site
 *
 * @private
 * @param {string} siteName                         The site name to launch.
 * @param {Object} siteConfig                       The main config.
 * @param {Object} nginxTemplates                   The ejs template.
 * @param {Object} [nginxConfig=siteConfig.nginx]   The nginx section of the
 *                                                  main config.
 * @returns {Promise}                               Promise resolving to the
 *                                                  main config.
 */
function _launchNginx(siteName, siteConfig, nginxTemplates, nginxConfig=siteConfig.nginx) {
  const nginx = getNginx();
  const siteAvailable = nginxConfig.sitesAvailable + siteName;
  const siteEnabled = nginxConfig.sitesEnabled + siteName;

  return _applyTemplate(siteConfig, nginxTemplates, nginxConfig).then(
    template=>writeFile(siteAvailable, template, {flags:'w', encoding:'utf-8'})
  ).then(
    ()=>_symlinker(siteAvailable, siteEnabled)
  ).then(
    ()=>nginx.reload()
  ).then(
    ()=>siteConfig
  );
}

/**
 * Launch nginx for given site config.
 *
 * @public
 * @param {Object} siteConfig   The site config.
 * @returns {Promise}           Promise resolving when nginx reloaded with
 *                              site running.
 */
function launchNginx(siteConfig) {
  const roots = siteConfig.root;
  const siteName = (siteConfig.shortName || siteConfig.userName);
  const nginxConfig = siteConfig.nginx;

  return _loadNginxTemplates(roots).then(nginxTemplates=>{
    return ((nginxConfig && nginxConfig.template && nginxTemplates[nginxConfig.template]) ?
      _launchNginx(siteName, siteConfig, nginxTemplates, nginxConfig) :
      siteConfig
    );
  });
}

module.exports = {
  launchNginx
};