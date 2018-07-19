'use strict';

const {showLoadMenus} = require('./lib/loadMenus');


async function gulp(args) {
	const locals = await showLoadMenus(args);

	if (args.hasOwnProperty('name') && args.hasOwnProperty('profile') && args.hasOwnProperty('task')) {
		const {runGulp} = loadBoltModule('gulp');
		const {initLogging} = loadBoltModule('app');

		await bolt.emitBefore('initialiseApp');
		initLogging({locals});
		await bolt.emitAfter('initialiseApp', locals, {locals});

		runGulp(args.task, {locals}, [`--boltRootDir=${boltRootDir}`]);
	}
}

module.exports = {
	gulp
};