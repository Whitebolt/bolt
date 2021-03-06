'use strict';

const xBreakingInCSPGetGlobal = /Function\(["']return this["']\)\(\)/g;
const cspReplace = 'window';
const cacheId = 'gulpReact';
const xNodeModules = /\/node_modules\//;


async function fn(
	gulp, rollupVinylAdaptor, sourcemaps, ignore, uglifyEs, rename, rollupBabel, rollupNodeResolve, rollupCommonjs,
	rollupJson, settings, replaceWithSourcemaps, header, done, rollup, rollupSourcemaps, babelResolveTransform,
	rollupReactBoltPlugin, path
) {
	const webPath = 'lib';
	const waiting = {current:2};
	const source = path.join(settings.cacheDir, `${settings.outputName}.js`);
	const dest = path.join(settings.boltRootDir, 'public', 'dynamic', settings.appName, webPath);
	const cache = bolt.getRollupBundleCache({cacheDir:settings.cacheDir, id:cacheId});
	const globals = {
		"lodash": "bolt",
		"prop-types": "PropTypes",
		"redux": "Redux",
		"react": "React",
		"react-dom": "ReactDOM"
	};

	rollupVinylAdaptor({
		rollup,
		input: {
			input: source,
			//cache,
			external: function(id, parent, isResolved) {
				if (id in globals) return true;
			},
			plugins: [
				rollupNodeResolve({
					...bolt.get(settings, 'nodeResolve', {}),
					extensions:bolt.uniq(['.jsx', ...bolt.get(settings, 'nodeResolve.extensions', [])])
				}),
				rollupCommonjs({}),
				rollupJson(),
				rollupBabel({
					generatorOpts: bolt.get(settings, 'babel.generatorOpts', {}),
					presets: bolt.get(settings, 'babel.presets', []),
					externalHelpers: true,
					sourceMaps: true,
					plugins: [
						babelResolveTransform(bolt.pick(settings, ['root'])),
						'@babel/plugin-external-helpers',
						...bolt.get(settings, 'babel.plugins', [])
					],
					ignore: [xNodeModules]
				}),
				rollupReactBoltPlugin(settings),
				rollupSourcemaps()
			]
		},
		output: {
			format: 'iife',
			name: settings.outputName,
			sourcemap: true,
			globals: function (id) {
				if (id in globals) return globals[id];
				console.log(id);
				return id;
			}
		}
	})
		.on('bundle', bundle=>bolt.saveRollupBundleCache({bundle, cacheDir:settings.cacheDir, id:cacheId, waiting, done}))
		.on('warn', warning=>console.warn(warning))
		.on('error', err=>{
			console.error(err);
			done();
		})
		.pipe(sourcemaps.init({loadMaps: true}))
		.pipe(rename(path=>{path.dirname = '';}))
		.pipe(header(`window.${settings.outputName} = {DEBUG:true};`))
		.pipe(replaceWithSourcemaps(xBreakingInCSPGetGlobal, cspReplace))
		.pipe(sourcemaps.write('./', {sourceMappingURLPrefix:`/${webPath}`}))
		.pipe(gulp.dest(dest))
		.pipe(ignore.exclude('*.map'))
		.pipe(uglifyEs.default({}))
		.pipe(rename(path=>{path.extname = '.min.js';}))
		.pipe(sourcemaps.write('./', {sourceMappingURLPrefix:`/${webPath}`}))
		.pipe(gulp.dest(dest))
		.on('end', ()=>bolt.waitCurrentEnd({waiting, done}));
}

module.exports = fn;