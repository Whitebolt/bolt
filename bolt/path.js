'use strict';
// @annotation zone server gulp manager

const {xTrailingSlash} = bolt.consts;


function pathIsEqual(path1, path2) {
	return (xTrailingSlash.replace(path1,'') === xTrailingSlash.replace(path2, ''))
}


module.exports = {
	pathIsEqual
};
