'use strict';

global.bolt = require('lodash').runInContext();

const {augment, get, argv} = require('@simpo/gulp-augment');
const path = require('path');

const xRollup = /^rollup/;


(argv.boltGulpModules || []).forEach(modulePath=>Object.assign(global.bolt, require(modulePath)));
argv.appName = argv.name;


function reformatBabelPluginId(id) {
	const [scope, pluginName] = id.split('/');
	const _pluginName = `plugin-${(!!pluginName?pluginName:scope)}`.replace('plugin-plugin-', 'plugin-');
	return ((!!pluginName)?[scope,_pluginName].join('/'):_pluginName);
}

function getBabelPlugins(plugins, require) {
	const log = new Set();
	return bolt.chain(bolt.makeArray(plugins))
		.map(id=>{
			const isArray = Array.isArray(id);
			if (!isArray && !bolt.isString(id)) return id
			const _id = isArray?id[0]:id;
			if (log.has(_id)) return;
			log.add(_id);
			const plugin = require(reformatBabelPluginId(_id));
			if (!isArray) return plugin;
			id[0] = plugin;
			return id;
		})
		.filter(id=>!!id)
		.value();
}


get('resolvers')
	.add(({param, require})=>{
		if (param === 'getBabelPlugins') return plugins=>getBabelPlugins(plugins, require);
	})
	.add(({param, require})=>{
		if (xRollup.test(param)) return require(`rollup-plugin-${bolt.kebabCase(param.replace(xRollup, ''))}`);
	})
	.add(
		({param, require, cwd})=>require(path.join(cwd,'lib',param))
	);

augment({'show-task-path':true});

