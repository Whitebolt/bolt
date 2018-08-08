'use strict';

const {showLoadMenus} = require('./lib/loadMenus');


async function gulp(args) {
	const locals = {...args, ...(await showLoadMenus(args))};
	locals.cacheDir = locals.cacheDir || bolt.getCacheDir({locals});

	if (args.hasOwnProperty('name') && args.hasOwnProperty('profile') && args.hasOwnProperty('task')) {
		const {runGulp} = loadBoltModule('gulp');
		const {initLogging} = loadBoltModule('app');

		await bolt.emitBefore('initialiseApp');
		initLogging({locals});
		await bolt.emitAfter('initialiseApp', locals, {locals});


		runGulp(args.task, {locals});
	}
}

module.exports = {
	gulp
};