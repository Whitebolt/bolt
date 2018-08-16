(function(global) {
	function makeArray(ary) {
		if (Array.isArray(ary)) return ary;
		if ((ary === null) || (ary === undefined)) return [];
		return [ary];
	}

	function getConfig() {
		var configElement = global.document.querySelector("[bolt-load]");
		if (!configElement) return {};
		var configTxt = (configElement.getAttribute('bolt-load') || "{}").trim();
		var config = JSON.parse((configTxt === "")?"{}":configTxt);

		config.mode = config.mode || "production";

		return config;
	}

	function createScriptElement(details, mode) {
		var script = global.document.createElement("script");
		script.src = "/scripts/" + mode + "/" + details.id + "/" + details.filename;
		script.defer = (details.hasOwnProperty("defer") ? details.defer : true);
		script.async = (details.hasOwnProperty("async") ? details.async : false);

		return script;
	}

	var config = getConfig();
	var head = global.document.querySelector("head");
	if (!!head) {
		makeArray(config.scripts).forEach(function(details) {
			var script = createScriptElement(details, config.mode);

			console.log("Adding", details.id);
			head.appendChild(script);
		});
	}
})(window);