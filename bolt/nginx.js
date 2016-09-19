'use strict';

const Promise = require('bluebird');
const fs = require('fs');
const writeFile = Promise.promisify(fs.writeFile);
const symLink = Promise.promisify(fs.symlink);

function launchNginx(siteConfig) {
  let roots = siteConfig.root;

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
          '/etc/nginx/sites-enabled/' + siteConfig.userName
        )
      }).then(()=>
        siteConfig
      );
    }
    return siteConfig;
  });
}

module.exports = {
  launchNginx
};