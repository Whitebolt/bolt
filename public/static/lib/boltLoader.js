(function(global) {
	var loaded = {};
	var loading = {};
	var onDeps = {};

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

	function addQueryParam(url, key, value) {
		try {
			return url + (~url.indexOf("?")?"&":"?") + key + "=" + value.toString().trim();
		} catch(err) {
			return url;
		}

	}

	function createScriptElement(details, onDepsCb) {
		var script = global.document.createElement("script");
		if (!loading[details.id]) loading[details.id] = false;

		script.src = details.browserPath;
		if (details.hasOwnProperty("cacheId")) script.src = addQueryParam(script.src, "cacheId", details.cacheId);
		script.defer = (details.hasOwnProperty("defer") ? details.defer : false);
		script.async = (details.hasOwnProperty("async") ? details.async : true);

		function onload() {
			loaded[details.id] = true;
			script.removeEventListener("load", onload);
			console.log("Loaded ["+(Date.now()-details.added)+"ms]", details.id);
			Object.keys(onDeps).forEach(id=>onDeps[id]());
			onload = undefined;
		}

		script.addEventListener("load", onload);
		if (!!details.deps && !!details.deps.length) {
			onDeps[details.id] = function() {
				var ready = true;
				details.deps.forEach(function(dep) {
					if (~details.deps.indexOf(dep)) ready = ready && !!loaded[dep];
				});
				if (ready && !! onDeps[details.id]) {
					delete onDeps[details.id];
					if (!!onDepsCb) onDepsCb(script);
					onDepsCb = undefined;
				}
			}
		} else {
			onDepsCb(script);
		}

		return script;
	}

	var config = getConfig();
	var head = global.document.querySelector("head");
	if (!!head) {
		makeArray(config.scripts).forEach(function(details) {
			loaded[details.id] = false;
			var script = createScriptElement(details, function(script) {
				if (!loading[details.id]) {
					loading[details.id] = true;
					console.log("Adding", details.id);
					details.added = Date.now();
					head.appendChild(script);
				}
			});
			if (!loaded[details.id] && !loading[details.id]) {
				var preload = global.document.createElement("link");
				preload.rel = "preload";
				preload.as = "script";
				preload.href = script.src;
				console.log("Pre-loading", details.id);
				head.appendChild(preload);
			}
		});
	}
})(window);