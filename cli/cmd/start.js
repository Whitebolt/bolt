'use strict';

const launcher = require(boltRootDir + '/server');
const inquirer = require('inquirer');

/**
 * Launch a bolt application.
 *
 * @param {Object} siteConfig     The application config to use to fire it up.
 */
function launchApp(siteConfig) {
	const boltConfigProperties = (bolt.mergePackageConfigs(siteConfig.root) || {}).boltConfigProperties;
	let boltConfig = bolt.pick(siteConfig, boltConfigProperties);
	launcher(boltConfig);
}

async function _createChoicesMenu(section) {
	const profiles = await require.import(`/etc/bolt/settings/${section}`, {
		extensions: ['.json'],
		basedir: __dirname,
		parent: __filename
	});

	const log = new Map();
	return Object.keys(profiles).map(value=>{
		const name = profiles[value].menuName || profiles[value].name;
		if (!log.has(name)) log.set(name, 0);
		log.set(name, log.get(name)+1);
		return {name, value}
	}).map(choice=>{
		if (log.get(choice.name) > 1) choice.name = `${choice.name} (${choice.value})`;
		return choice;
	}).sort((a,b)=>(((a.name>b.name)?1:((a.name<b.name)?-1:0))));
}

async function _provideMenu(args) {
	const questions = [];
	if (!args.name) questions.push({
		type:'list',
		choices: await _createChoicesMenu('apps'),
		name:'name',
		message: 'Please select an App to launch:'
	});
	if (!args.profile) questions.push({
		type:'list',
		choices: await _createChoicesMenu('profiles'),
		name:'profile',
		message: 'Please select a profile to run your app under:'
	});

	Object.assign(args, await inquirer.prompt(questions));
}

/**
 * Start an bolt application.
 *
 * @param {Object} args     Arguments parsed from the commandline.
 * @returns {Promise}       Promise resolving when app has launched.
 */
async function start(args) {
	if (!args.name || !args.profile) await _provideMenu(args);

	if (args.hasOwnProperty('name') && args.hasOwnProperty('profile')) {
		const siteConfig = await bolt.loadConfig(args.name, args.profile);
		siteConfig.development = ((process.getuid && process.getuid() !== 0)?true:args.development) || siteConfig.development;
		siteConfig.production = ((process.getuid && process.getuid() === 0)?true:args.production) || siteConfig.production;

		if (siteConfig.hasOwnProperty('questions')) {
			const questions = siteConfig.questions.filter(question=>{
				if (!question.profile) return true;
				if (bolt.makeArray(question.profile).indexOf(args.profile) !== -1) return true;
			});
			const answers = await inquirer.prompt(questions);
			Object.keys(answers).forEach(propPath=>
				bolt.set(siteConfig, propPath, answers[propPath])
			);
			delete siteConfig.questions;
		}

		console.log('\x1bc'); // Clear the console

		if (!siteConfig.development && siteConfig.production) {
			siteConfig.sock = `${siteConfig.runDirectory}/${siteConfig.name}-${process.pid}.sock`;
			await bolt.addUser(siteConfig);
			await bolt.launchNginx(siteConfig);
			const app = await bolt.pm2LaunchApp(siteConfig);
			console.log(app.pm2_env.name, 'launched with id:', app.pm2_env.pm_id);
			process.exit();
		} else {
			await launchApp(siteConfig);
		}
	} else {
		throw new Error('No app specified');
	}
}

module.exports = {
	start
};
