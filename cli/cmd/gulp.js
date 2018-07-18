'use strict';

const {showLoadMenus} = require('./lib/loadMenus');


async function gulp(args) {
	const config = await showLoadMenus(args);

	if (args.hasOwnProperty('name') && args.hasOwnProperty('profile') && args.hasOwnProperty('task')) {
		const {runGulp} = loadBoltModule('gulp');
		const {initLogging} = loadBoltModule('app');

		await bolt.emitBefore('initialiseApp');
		initLogging({config});
		await bolt.emitAfter('initialiseApp', config, {config});

		runGulp(args.task, {config}, [`--boltRootDir=${boltRootDir}`]);
	}
}

module.exports = {
	gulp
};