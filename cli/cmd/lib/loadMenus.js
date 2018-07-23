'use strict';

const path = require('path');
const inquirer = require('inquirer');


async function _createChoicesMenu(section) {
	const profiles = await require.import(
		path.join('/etc/bolt/settings', section), {
			extensions: ['.json']
		}
	);

	const log = new Map();
	return bolt.chain(profiles)
		.keys()
		.map(value=>{
			const name = profiles[value].menuName || profiles[value].name;
			if (!log.has(name)) log.set(name, 0);
			log.set(name, log.get(name)+1);
			return {name, value}
		}).map(choice=>{
			if (log.get(choice.name) > 1) choice.name = `${choice.name} (${choice.value})`;
			return choice;
		}).sort(
			(a,b)=>(((a.name>b.name)?1:((a.name<b.name)?-1:0)))
		)
		.value();
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

async function showLoadMenus(args) {
	if (!args.name || !args.profile) await _provideMenu(args);
	const siteConfig = await bolt.loadConfig(args.name, args.profile);

	if (args.hasOwnProperty('name') && args.hasOwnProperty('profile') && siteConfig.hasOwnProperty('questions')) {
		siteConfig.development = ((process.getuid && process.getuid() !== 0)?true:args.development) || siteConfig.development;
		siteConfig.production = ((process.getuid && process.getuid() === 0)?true:args.production) || siteConfig.production;

		const questions = siteConfig.questions.filter(question=>(
			(!question.profile || (bolt.makeArray(question.profile).indexOf(args.profile) !== -1)) &&
			!bolt.makeArray(question.choices).find(choice=>
				(choice.hasOwnProperty('cmdOption') && args.hasOwnProperty(choice['cmdOption']))
			)
		));

		const answers = await inquirer.prompt(questions);

		siteConfig.questions.forEach(question=>{
			const answer = bolt.makeArray(question.choices).find(choice=>
				(choice.hasOwnProperty('cmdOption') && args.hasOwnProperty(choice['cmdOption']))
			);
			if (!!answer) bolt.set(answers, question.name, answer.value);
		});

		Object.keys(answers).forEach(propPath=>bolt.set(siteConfig, propPath, answers[propPath]));
		delete siteConfig.questions;
	}

	return siteConfig;
}

module.exports = {
	showLoadMenus
};