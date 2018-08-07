'use strict';

const cacheId = 'gulpBolt';


function fn(
	gulp, rollupVinylAdaptor, sourcemaps, ignore, uglifyEs, rename, rollupBabel, rollupNodeResolve, rollupCommonjs,
	settings, done, rollup, rollupJson, babelResolveTransform, gulpBoltBrowser, path
) {
	const webPath = 'lib';
	const waiting = {current:2};
	const source = path.join(settings.cacheDir, `${settings.outputName}.js`);
	const dest = path.join(settings.boltRootDir, 'public', 'dynamic', settings.appName, webPath);
	const cache = bolt.getRollupBundleCache({cacheDir:settings.cacheDir, id:cacheId});

	rollupVinylAdaptor({
		rollup,
		input: {
			input: source,
			external: ['text-encoding'],
			//cache,
			plugins: [
				rollupNodeResolve(bolt.get(settings, 'nodeResolve', {})),
				rollupCommonjs({}),
				rollupJson(),
				rollupBabel({
					exclude: 'node_modules/**',
					generatorOpts: bolt.get(settings, 'babel.generatorOpts', {}),
					presets: bolt.get(settings, 'babel.presets', []),
					externalHelpers: true,
					sourceMaps: true,
					plugins: [
						babelResolveTransform(bolt.pick(settings, ['root'])),
						'@babel/plugin-external-helpers',
						...bolt.get(settings, 'babel.plugins', [])
					]
				})
			]
		},
		output: {
			globals: {'text-encoding':'window'},
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
		.pipe(gulpBoltBrowser())
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