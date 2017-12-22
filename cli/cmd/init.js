'use strict';

const fs = require('fs');
const util = require('util');
const write = util.promisify(fs.writeFile);

const packageJson = {
	name:"",
	version: "0.0.1",
	description: "",
	main:"./src/scripts/index.js",
	keywords:["bolt"],
	devDependencies:{},
	dependencies:{},
	gulp:{
		globalLibAbsolute: "${globalModulePath}/public/${directories.lib}",
		copyProps: ["config.appId", "config.directories"],
		source: {
			root: "${cwd}/src",
			styles: [
				"${source.root}/${directories.styles}/index.scss"
			]
		},
		dest: {
			root: "${cwd}/public",
			styles: "${dest.root}/${directories.styles}",
			scripts: "${dest.root}/${directories.scripts}",
			lib: "${dest.root}/${directories.lib}"
		},
		sass: {
			outputStyle: "compressed",
			includePaths: [
				"${cwd}/src/styles",
				"${cwd}/src/scripts"
			]
		},
	},
	config: {
		appId: "${name}",
		directories: {
			scripts: "scripts",
			styles: "styles",
			lib: "lib"
		},
		lib: [
			"/${directories.lib}/bolt.js",
			"/${directories.lib}/websockets-express/scripts/index.min.js",
			"/${directories.scripts}/router.js",
			"/${directories.lib}/react.js",
			"/${directories.lib}/react-dom.js",
			"/${directories.lib}/ReactBolt.js",
			"/${directories.lib}/redux.js",
			"/${directories.lib}/ReduxBolt.js"
		],
		css: [
			"/${directories.lib}/font-awesome/css/font-awesome.min.css",
			"/${directories.styles}/${appId}.css"
		]
	}
};

const gitIgnore = `.idea/
node_modules/
logs/
public/styles/
public/scripts/
local.json
tasks/
upload/`;

function getProjectDirectories(project) {
	return [
		`${project}`,
		`${project}/.idea`,
		`${project}/components`,
		`${project}/src/scripts`,
		`${project}/src/styles`,
		`${project}/public/scripts`,
		`${project}/public/styles`,
		`${project}/public/lib`,
		`${project}/public/media/images`,
		`${project}/tasks`,
		`${project}/templates`,
	];
}

async function writeFiles(project) {
	packageJson.name = project;
	await write(`${global.__originalCwd}/${project}/package.json`, JSON.stringify(packageJson));
	await write(`${global.__originalCwd}/${project}/.gitignore`, JSON.stringify(gitIgnore));
	await write(`${global.__originalCwd}/${project}/local.json`, JSON.stringify({}));
}

async function createDirectoryStructure(project='') {
	await Promise.all(getProjectDirectories(`${global.__originalCwd}/${project}`)
		.map(path=>bolt.makeDirectory(path))
	);
}

async function init(args) {
	await createDirectoryStructure(args.project);
	await writeFiles(args.project);
}

module.exports = {
	init
};
