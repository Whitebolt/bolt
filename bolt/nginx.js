'use strict';

const Promise = require('bluebird');
const fs = require('fs');
const writeFile = Promise.promisify(fs.writeFile);
const symLink = Promise.promisify(fs.symlink);
const rename = Promise.promisify(fs.rename);
const Nginx = require('nginx-o');

function launchNginx(siteConfig) {
  const nginx = new Nginx();
  let roots = siteConfig.root;

  nginx.on('started', ()=>{ console.log('nginx has started'); });
  nginx.on('stopped', ()=>{ console.log('nginx has stopped'); });

  return bolt.loadEjsDirectory(roots, 'nginx', {
    locals: false,
    localsName: ['config']
  }).then(nginxTemplates=>{
    if (siteConfig.nginx && siteConfig.nginx.template && nginxTemplates[siteConfig.nginx.template]) {
      return nginxTemplates[siteConfig.nginx.template].compiled(siteConfig).then(template=>{
        return writeFile('/etc/nginx/sites-available/' + siteConfig.userName, template, {
          flags:'w',
          encoding:'utf-8'
        });
      }).then(()=>{
        symLink(
          '/etc/nginx/sites-available/' + siteConfig.userName,
          '/etc/nginx/sites-enabled/' + siteConfig.userName + '_TEMP'
        )
      }).then(()=>{// This allows overwrites of symlink (better than deleting).
        rename(
          '/etc/nginx/sites-enabled/' + siteConfig.userName + '_TEMP',
          '/etc/nginx/sites-enabled/' + siteConfig.userName
        )
      }).then(()=>
        nginx.reload()
      ).then(()=>
        siteConfig
      );
    }
    return siteConfig;
  });
}

module.exports = {
  launchNginx
};