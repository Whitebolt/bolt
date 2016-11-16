'use strict';

const chai = require('chai');
const assert = chai.assert;
const morphEnv = require('mock-env').morph;

global.boltRootDir = process.cwd();
global.bolt = Object.assign(
  require('lodash'),
  require(getFilePathForSubject('boolean')),
  require(getFilePathForSubject('number')),
  require(getFilePathForSubject('object')),
  require(getFilePathForSubject('bolt')),
  require(getFilePathForSubject())
);

let root = global.boltRootDir;


function getFilePathForSubject(fileName=__filename) {
  return process.cwd() + __dirname.replace(new RegExp('^' + process.cwd() + '/test'), '') + '/' + fileName.split('/').pop();
}

function changeRootAndReload(newRoot=root) {
  delete require.cache[require.resolve(getFilePathForSubject())];
  delete require.cache[require.resolve(boltRootDir+'/package.json')];
  global.boltRootDir = newRoot;
  global.bolt = Object.assign(bolt, require(getFilePathForSubject()));
}

describe('bolt.config', ()=>{
  describe('bolt.loadConfig()', ()=>{

  });

  describe('bolt.getKeyedEnvVars()', ()=>{
    it(`Should load tagged environment variables and return as object - defaulting to tag of 'BOLT'.`, ()=>{
      morphEnv(()=>{
        let config = bolt.getKeyedEnvVars();
        assert.deepEqual(config, {test1:'HELLO1', test2:'HELLO2', test3:'HELLO3'});
      }, {
        'BOLT_TEST1': 'HELLO1',
        'BOLT_TEST2': 'HELLO2',
        'NBOLT_TEST1': 'NOT HELLO1',
        'BOLT_TEST3': 'HELLO3'
      });
    });

    it(`Should load tagged environment variables ignoring case of tag.`, ()=>{
      morphEnv(()=>{
        let config = bolt.getKeyedEnvVars();
        assert.deepEqual(config, {test1:'HELLO1', test2:'HELLO2', test3:'HELLO3'});
      }, {
        'BOLT_TEST1': 'HELLO1',
        'bolt_TEST2': 'HELLO2',
        'Bolt_TEST3': 'HELLO3'
      });
    });

    it(`Should load tagged environment variables and return the properties as camelCase versions.`, ()=>{
      morphEnv(()=>{
        let config = bolt.getKeyedEnvVars();
        assert.deepEqual(config, {testMe:'HELLO1', testMeOut:'HELLO2', testMeOut3:'HELLO3'});
      }, {
        'BOLT_TEST_ME': 'HELLO1',
        'BOLT_TEST_ME_OUT': 'HELLO2',
        'BOLT_TestMeOut3': 'HELLO3'
      });
    });

    it(`Should convert values to their types of string, integer, double, Array and boolean`, ()=>{
      morphEnv(()=>{
        let config = bolt.getKeyedEnvVars();
        assert.isString(config.string);
        assert.isBoolean(config.booleanTrue1);
        assert.isTrue(config.booleanTrue1);
        assert.isBoolean(config.booleanFalse1);
        assert.isFalse(config.booleanFalse1);
        assert.isBoolean(config.booleanTrue2);
        assert.isTrue(config.booleanTrue2);
        assert.isBoolean(config.booleanFalse2);
        assert.isFalse(config.booleanFalse2);
        assert.isBoolean(config.booleanTrue3);
        assert.isTrue(config.booleanTrue3);
        assert.isBoolean(config.booleanFalse3);
        assert.isFalse(config.booleanFalse3);
        assert.isNumber(config.integer);
        assert.isTrue(Number.isInteger(config.integer));
        assert.isNumber(config.double);
        assert.isFalse(Number.isInteger(config.double));
        assert.isArray(config.array);
        assert.isNumber(config.array[0]);
        assert.isString(config.array[1]);
        assert.isBoolean(config.array[3]);
      }, {
        'BOLT_STRING': 'HELLO',
        'BOLT_BOOLEAN_TRUE1': 'true',
        'BOLT_BOOLEAN_FALSE1': 'false',
        'BOLT_BOOLEAN_TRUE2': 'yes',
        'BOLT_BOOLEAN_FALSE2': 'no',
        'BOLT_BOOLEAN_TRUE3': 'on',
        'BOLT_BOOLEAN_FALSE3': 'off',
        'BOLT_INTEGER': '1',
        'BOLT_DOUBLE': '1.1',
        'BOLT_ARRAY': '1:test:3:off'
      });
    });

    it(`Should load from alternative tag if supplied`, ()=>{
      morphEnv(()=>{
        let config = bolt.getKeyedEnvVars();
        assert.deepEqual(config, {});
      }, {
        'BOLT2_TEST1': 'HELLO1',
        'bolt2_TEST2': 'HELLO2',
        'Bolt2_TEST3': 'HELLO3'
      });

      morphEnv(()=>{
        let config = bolt.getKeyedEnvVars('BOLT2');
        assert.deepEqual(config, {test1:'HELLO1', test2:'HELLO2', test3:'HELLO3'});
      }, {
        'BOLT2_TEST1': 'HELLO1',
        'bolt2_TEST2': 'HELLO2',
        'Bolt2_TEST3': 'HELLO3'
      });
    });

    it(`Should load from alternative environment object if supplied`, ()=>{
      let config = bolt.getKeyedEnvVars('BOLT2', {
        'BOLT_TEST1': 'HELLO1',
        'bolt_TEST2': 'HELLO2',
        'Bolt_TEST3': 'HELLO3'
      });
      assert.deepEqual(config, {});

      config = bolt.getKeyedEnvVars('BOLT3', {
        'BOLT3_TEST1': 'HELLO1',
        'bolt3_TEST2': 'HELLO2',
        'Bolt3_TEST3': 'HELLO3'
      });
      assert.deepEqual(config, {test1:'HELLO1', test2:'HELLO2', test3:'HELLO3'});
    });
  });

  describe('bolt.mergePackageConfigs()', ()=>{
    it('Should default load config objects from package.json in supplied directories and merge.',()=>{
      let config = bolt.mergePackageConfigs([
        __dirname+'/config/test1/',
        __dirname+'/config/test2/'
      ]);
      assert.deepEqual(config, { test1:'TEST1', test2:'TEST2'});

      config = bolt.mergePackageConfigs([
        __dirname+'/config/test1/',
        __dirname+'/config/test2/',
        __dirname+'/config/test3/'
      ]);
      assert.deepEqual(config, {test1:'TEST3', test2:'TEST2'});

      config = bolt.mergePackageConfigs([
        __dirname+'/config/test1/',
        __dirname+'/config/test2/',
        __dirname+'/config/test3/',
        __dirname+'/config/test4/'
      ]);
      assert.deepEqual(config, {test1:{
        "test1_1":"TEST1_1",
        "test1_2":"TEST1_2"
      }, test2:'TEST2'});

      config = bolt.mergePackageConfigs([
        __dirname+'/config/test1/',
        __dirname+'/config/test2/',
        __dirname+'/config/test3/',
        __dirname+'/config/test4/',
        __dirname+'/config/test5/'
      ]);
      assert.deepEqual(config, {test1:{
        test1_1:"TEST1_2",
        test1_2:"TEST1_2",
        test1_3:"TEST1_3"
      }, test2:'TEST2'});
    });

    it('Should be able to override use of config property.',()=>{
      let config = bolt.mergePackageConfigs([
        __dirname+'/config/test1/',
        __dirname+'/config/test2/'
      ], 'config2');
      assert.deepEqual(config, {test1:'TEST2', test2:'TEST3'});
    });

    it('Should be able to override use of config property deeply.',()=>{
      let config = bolt.mergePackageConfigs([
        __dirname+'/config/test4/',
        __dirname+'/config/test5/'
      ], 'config.test1');
      assert.deepEqual(config, {test1_1:'TEST1_2', test1_2:'TEST1_2', test1_3:'TEST1_3'});
    });
  });

  describe('bolt.mergePackageProperties()', ()=>{
    it('Should load properties from package.json files and merge.',()=>{
      let config = bolt.mergePackageProperties([
        __dirname+'/config/test1/',
        __dirname+'/config/test2/'
      ], ['description', 'name', 'version']);
      assert.deepEqual(config, {name: "test-2", version: "2.0.0", description: "TEST 1"});
    });

    it('Should deeply load properties from package.json files and merge.',()=>{
      let config = bolt.mergePackageProperties([
        __dirname+'/config/test1/',
        __dirname+'/config/test2/'
      ], ['description', 'name', 'version', 'config.test1']);
      assert.deepEqual(config, {name: "test-2", version: "2.0.0", description: "TEST 1", config:{test1:"TEST1"}});
    });
  });

  describe('bolt.getConfigLoadPaths()', ()=>{
    it(`Should get config paths from root folder then package.json config location.`, ()=>{
      changeRootAndReload(global.boltRootDir + '/test/bolt/config/test6');
      let paths = bolt.getConfigLoadPaths();
      assert.deepEqual(paths, [global.boltRootDir + '/server.json', '/etc/bolt/server.json']);
      changeRootAndReload();
    });

    it(`Changing 'serverConfigFile' in package.json should change the json file loaded.`, ()=>{
      changeRootAndReload(global.boltRootDir + '/test/bolt/config/test7');
      let paths = bolt.getConfigLoadPaths();
      assert.deepEqual(paths, [global.boltRootDir + '/test.json', '/etc/bolt/test.json']);
      changeRootAndReload();
    });

    it(`Changing 'serverConfigPath' in package.json should change global config referenced.`, ()=>{
      changeRootAndReload(global.boltRootDir + '/test/bolt/config/test8');
      let paths = bolt.getConfigLoadPaths();
      assert.deepEqual(paths, [global.boltRootDir + '/server.json', '/notetc/bolt/server.json']);
      changeRootAndReload();
    });

    it(`If no 'serverConfigPath' specified then remove from paths.`, ()=>{
      changeRootAndReload(global.boltRootDir + '/test/bolt/config/test9');
      let paths = bolt.getConfigLoadPaths();
      assert.deepEqual(paths, [global.boltRootDir + '/server.json']);
      changeRootAndReload();
    });

    it(`Changing env.BOLT_CONFIG should load extra paths`, ()=>{
      morphEnv(()=>{
        changeRootAndReload(global.boltRootDir + '/test/bolt/config/test6');
        let paths = bolt.getConfigLoadPaths();
        assert.deepEqual(paths, [global.boltRootDir + '/server.json', '/notetc/bolt/server.json', '/etc/bolt/server.json']);
        changeRootAndReload();
      }, {
        'BOLT_CONFIG': '/notetc/bolt'
      });
    });

    it(`Changing env.BOLT_CONFIG should to an array should load all extra paths`, ()=>{
      morphEnv(()=>{
        changeRootAndReload(global.boltRootDir + '/test/bolt/config/test6');
        let paths = bolt.getConfigLoadPaths();
        assert.deepEqual(paths, [global.boltRootDir + '/server.json', '/etc1/bolt/server.json', '/etc2/bolt/server.json', '/etc3/bolt/server.json', '/etc/bolt/server.json']);
        changeRootAndReload();
      }, {
        'BOLT_CONFIG': '/etc1/bolt:/etc2/bolt:/etc3/bolt'
      });
    });
  });

  describe('bolt.getPackage()', ()=>{
    it(`Should load package.json from given directory.`, ()=>{
      let data = bolt.getPackage(__dirname+'/config/test1/');
      assert.equal(data.name, "test-1");
    });

    it(`Should load package.json root directory for this package if no directory supplied.`, ()=>{
      let data1 = bolt.getPackage();
      let data2 = require(boltRootDir + '/package.json');
      assert.deepEqual(data1, data2);
    });

    it(`Should return an empty object if package.json not found.`, ()=>{
      let data = bolt.getPackage(__dirname+'/config/test/');
      assert.deepEqual(data, {});
    });
  });
});