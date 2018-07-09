#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const packageData = require('../package.json');
const util = require('util');
const child_process = require('child_process');


async function addGlobalBin() {
	const serverScript = path.normalize(path.dirname(fs.realpathSync(`${__filename}/../`)) + '/' + packageData.main);
	const globalBoltExe = '/usr/local/bin/bolt';
	const unlink = util.promisify(fs.unlink);
	const symlink = util.promisify(fs.symlink);

	try {
		await unlink(globalBoltExe);
		try {
			await symlink(serverScript, globalBoltExe);
		} catch (error) {
			console.error(error);
		}
	} catch (error) {
		if (error && error.code === 'EACCES') {
			return console.error('Permission denied, creating global bolt.  Please use `sudo`');
		}
	}
}


addGlobalBin();