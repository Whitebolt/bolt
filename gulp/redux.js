'use strict';

const cacheId = 'gulpBolt';

const xBreakingInCSPGetGlobal = /Function\(["']return this["']\)\(\)/g;
const cspReplace = 'window';


function fn(
	gulp, sourcemaps, ignore, uglifyEs, rename, rollupBabel, rollupNodeResolve, rollupCommonjs, rollupJson, settings,
	replaceWithSourcemaps, done, rollup, rollupVinylAdaptor, babelResolveTransform, path
) {
	const webPath = 'lib';
	const waiting = {current:2};
	const source = path.join(settings.cacheDir, `${settings.outputName}.js`);
	const dest = path.join(settings.boltRootDir, 'public', 'dynamic', settings.appName, webPath);
	const cache = bolt.getRollupBundleCache({cacheDir:settings.cacheDir, id:cacheId});

	rollupVinylAdaptor({
		rollup,
		input: {
			//cache,
			input: source,
			plugins: [
				rollupNodeResolve({
					...bolt.get(settings, 'nodeResolve', {}),
					extensions:[
						'.jsx',
						...bolt.get(settings, 'nodeResolve.extensions', [])
					]
				}),
				rollupCommonjs(),
				rollupJson(),
				rollupBabel({
					generatorOpts: bolt.get(settings, 'babel.generatorOpts', {}),
					externalHelpers: true,
					sourceMaps: true,
					presets: bolt.get(settings, 'babel.presets', []),
					plugins: [
						babelResolveTransform(bolt.pick(settings, ['root'])),
						'@babel/plugin-external-helpers',
						...bolt.get(settings, 'babel.plugins', [])
					]
				})
			]
		},
		output: {
			format: 'iife',
			name: settings.outputName,
			sourcemap: true
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