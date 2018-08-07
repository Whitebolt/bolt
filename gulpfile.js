'use strict';

global.bolt = require('lodash').runInContext();

const {augment, get, argv} = require('@simpo/gulp-augment');
const path = require('path');

const xRollup = /^rollup/;


(argv.boltGulpModules || []).forEach(modulePath=>Object.assign(global.bolt, require(modulePath)));
argv.appName = argv.name;


get('resolvers')
	.add(({param, require})=>{
		if (xRollup.test(param)) return require(`rollup-plugin-${bolt.kebabCase(param.replace(xRollup, ''))}`);
	})
	.add(
		({param, require, cwd})=>require(path.join(cwd,'lib',param))
	);

augment({'show-task-path':true});

