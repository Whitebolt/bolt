'use strict';

const stream = require('stream');
const rollupStream = require('rollup-stream');
const source = require('vinyl-source-stream');
const vinylBuffer = require('vinyl-buffer');
const gulpSourcemaps = require('gulp-sourcemaps');
const through = require('through2');
const path = require('path');
const rollupNodeResolve = require('rollup-plugin-node-resolve');
const rollupCommonJs = require('rollup-plugin-commonjs');
const rollupBabel = require('rollup-plugin-babel');

const xBreakingInCSPGetGlobal = /Function\(["']return this["']\)\(\)/g;

bolt.ExportToBrowserBoltEvent = class ExportToBrowserBoltEvent extends bolt.Event {};

function rollupMemoryPlugin(config = {}) {
  function isPath(path) {
    return typeof path === 'string';
  }

  function isContents(contents) {
    return typeof contents === 'string' || Buffer.isBuffer(contents);
  }


  let path = isPath(config.path) ? config.path : null;
  let contents = isContents(config.contents) ? String(config.contents) : null;

  return {
    options(options) {
      const { input } = options;
      if (input && typeof input === 'object') {
        if (isPath(input.path)) path = input.path;
        if (isContents(input.contents)) contents = String(input.contents);
      }
      options.input = path;
    },

    resolveId(id) {
      if (path === null || contents === null) {
        throw Error('\'path\' should be a string and \'contents\' should be a string of Buffer');
      }
      if (id === path) return path;
    },

    load(id) {
      if (id === path) return contents;
    }
  };
}


module.exports = function() {
  // @annotation key loadAllComponents
  // @annotation when after

  function compileBolt(contents) {
    const compiled = {};

    return new Promise((resolve, reject)=>{
      rollupStream({
        input: {contents, path:boltRootDir+'/bolt.js'},
        format: 'iife',
        name: 'bolt',
        sourcemap: true,
        plugins: [
          rollupMemoryPlugin(),
          rollupNodeResolve({
            jsnext: true,
            main: true,
            extensions: ['.js', '.json'],
            browser: true
          }),
          rollupCommonJs({}),
          rollupBabel({
            exclude: 'node_modules/**',
            runtimeHelpers: true,
            presets: [['env', {
              modules: false,
              targets: {uglify: true},
              include: ['babel-plugin-transform-es2015-spread'],
              useBuiltIns: true
            }]],
            plugins: [
              'transform-runtime',
              'syntax-async-functions',
              'syntax-async-generators',
              'transform-async-generator-functions',
              'transform-regenerator',
              'external-helpers'
            ]
          })
        ]
      })
        .pipe(source('bolt.js'))
        .pipe(vinylBuffer())
        .pipe(gulpSourcemaps.init({loadMaps: true}))
        .pipe(through.obj(function (file, encoding, callback) {
          // So CSP does not break, it is always browser anyway.
          let contents = file.contents.toString().replace(xBreakingInCSPGetGlobal, 'window');
          contents += `//# sourceMappingURL=${path.basename(file.path)}.map`;
          compiled.file = contents;
          compiled.sourceMap = file.sourceMap;
          this.emit('end');
          return callback(null, file);
        })).on('end', ()=>{
          resolve(compiled);
        }).on('error', error=>reject(error));
    });
  }

  return async (app)=>{
    let boltContent = '';
    const names = [...bolt.__modules].map(target=>{
      const exports = require(target);
      if (bolt.annotation.get(exports, 'browser-export')) {
        const type = 'exportBoltToBrowserGlobal';
        bolt.emit(type, new bolt.ExportToBrowserBoltEvent({type, target, sync: false}));
        const name = 'module'+bolt.randomString(10);
        boltContent += `import ${name} from "${target}";\n`;
        return name;
      }
    }).filter(name=>name);

    boltContent += `import lodash from "lodash";\n`;
    names.push('lodash');

    bolt.__modules.clear();
    delete bolt.__modules;

    boltContent += 'const bolt = Object.assign({}';
    names.forEach(name=>{boltContent += ', ' + name;});
    boltContent += ');\n';
    boltContent += 'export default bolt;';

    const compiled = await compileBolt(boltContent);
    app.__boltJs = compiled.file;
    app.__boltJsMap = compiled.sourceMap;
  }
};