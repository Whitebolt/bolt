#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const packageData = require('../package.json');

const serverScript = path.normalize(path.dirname(fs.realpathSync(`${__filename}/../`)) + '/' + packageData.main);
const globalBoltExe = '/usr/local/bin/bolt';


fs.unlink(globalBoltExe, error=>{
	if (error && error.code === 'EACCES') {
		return console.log('Permission denied, creating global bolt.  Please use `sudo`');
	}
	fs.symlink(serverScript, globalBoltExe, error=>{
		if (error) console.log(error);
	});
});