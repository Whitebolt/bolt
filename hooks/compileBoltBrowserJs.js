'use strict';

const babel = require('babel-core');
const rollup = require('rollup');
const rollupNodeResolve = require('rollup-plugin-node-resolve');
const rollupCommonJs = require('rollup-plugin-commonjs');
const rollupBabel = require('rollup-plugin-babel');

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

  async function compileBolt(contents) {
    try {
      const bundle = await rollup.rollup({
        input: {contents, path: 'bolt.js'},
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
      });
      const { code } = await bundle.generate({format:'iife', sourcemap:false, name:'bolt'});
      return code;
    } catch (error) {
      console.error(error);
    }
  }

  return async (app)=>{
    let boltContent = '';
    const names = [...bolt.__modules].map(exports=>{
      if (bolt.annotation.get(exports, 'browser-export')) {
        const modulePath = bolt.annotation.get(exports, 'modulePath');
        const name = 'module'+bolt.randomString(10);
        boltContent += `import ${name} from "${modulePath}";\n`;
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

    app.__boltJs = await compileBolt(boltContent);
  }
};