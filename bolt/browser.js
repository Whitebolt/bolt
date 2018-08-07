'use strict';
// @annotation zone browser server

function docReady(cb) {
	// This is extracted from jQuery.ready(), we want the works in all situations provided by jQuery without
// the jQuery dependency. (@see https://github.com/jquery/jquery/blob/master/src/core/ready.js).
	function completed() {
		document.removeEventListener("DOMContentLoaded", completed);
		window.removeEventListener("load", completed);
		cb();
	}

	if (document.readyState==="complete" || (document.readyState !=="loading" && !document.documentElement.doScroll)) {
		window.setTimeout(cb);
	} else {
		document.addEventListener( "DOMContentLoaded", completed );
		window.addEventListener( "load", completed );
	}
}


module.exports = {
	docReady
};