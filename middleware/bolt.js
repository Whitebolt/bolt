'use strict';

const apps = new WeakSet();

function init(app) {
	// @annotation priority 0

	app.use((req, res, next)=>{
		const {app} = req;
		if (!apps.has(app)) {
			apps.add(app);
			Object.defineProperty(app, 'config', {
				get: ()=>{
					console.warn('Using app.config is depreciated, please use app.locals instead.');
					console.trace();
					return app.locals;
				},
				set: ()=>{
					console.warn('Using app.config is depreciated, please use app.locals instead.');
					console.trace();
					return false;
				}
			});
		}

		Object.defineProperty(req, 'doc', {
			get: ()=>{
				console.warn('Using req.doc is depreciated, please use res.locals.doc instead.');
				console.trace();
				return app.locals;
			},
			set: ()=>{
				console.warn('Using req.doc is depreciated, please use res.locals.doc instead.');
				console.trace();
				return false;
			}
		});

		next();
	});
}

module.exports = init;
