'use strict';

const {sep} = require('path');

const consts = {
	xUseStrict: /["']use strict["'](?:\;|)/,
	xIsExternalModule: new RegExp(`\\${sep}node_modules\\${sep}`),
	isInternalModule: target=>!consts.xIsExternalModule.test(target)
};

module.exports = consts;