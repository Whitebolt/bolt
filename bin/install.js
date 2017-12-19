#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const packageData = require('../package.json');
const util = require('util');
const child_process = require('child_process');
const prependFile = util.promisify(require('prepend-file'));

const lodashExclude = ['fill','findIndex','indexOf','join','reverse','slice','forEach','each','eachRight','forEachRight','filter','find','findLast','forEach','forEachRight','map','reduce','reduceRight','size','assign','trim','replace','toLower','toUpper'].map(item=>`'${item}'`);

function exec(command, options={}) {
	return new Promise((resolve, reject)=>
		child_process.exec(command, options, (error, stdout, stderr)=>{
			if (error) return reject(error);
			const errorMsg = stderr.toString();
			if (errorMsg.length) return reject(errorMsg);
			return resolve(stdout.toString());
		})
	);
}

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


async function addLocalLodash() {
	const lodashScript = path.normalize(path.dirname(fs.realpathSync(`${__filename}/../`)) + '/lib/lodash.js');
	const lodashScriptMin = lodashScript.replace('.js', '.min.js');
	const cmdOptions = {};
	const cmd = `${require.resolve('lodash-cli')} -o ${lodashScript} exports="node" minus=${lodashExclude.join(',')}`;
	if (process.env.SUDO_UID) cmdOptions.uid = parseInt(process.env.SUDO_UID, 10);
	if (process.env.SUDO_GID) cmdOptions.gid = parseInt(process.env.SUDO_GID, 10);
	try {
		const stdout = await exec(cmd, cmdOptions);
		console.log(stdout);
		await prependFile(lodashScript, '// @annotation browser-export\n');
		await prependFile(lodashScriptMin, '// @annotation browser-export\n');
	} catch (error) {
		console.error(error);
	}
}

addGlobalBin().then(addLocalLodash);