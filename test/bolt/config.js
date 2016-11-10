'use strict';

const chai = require('chai');
const assert = chai.assert;
const morphEnv = require('mock-env').morph;

global.boltRootDir = process.cwd();
global.bolt = Object.assign(
  require('lodash'),
  require(getFilePathForSubject('boolean')),
  require(getFilePathForSubject('number')),
  require(getFilePathForSubject('bolt')),
  require(getFilePathForSubject())
);

function getFilePathForSubject(fileName=__filename) {
  return process.cwd() + __dirname.replace(new RegExp('^' + process.cwd() + '/test'), '') + '/' + fileName.split('/').pop();
}

function stubEnv(routine, stubbedEnv={}) {
  let env = process.env;
  process.env = stubbedEnv;
  routine();
  process.env = env;
}

function stubEnvIt(statement, routine, stubbedEnv={}) {
  let env = process.env;
  process.env = stubbedEnv;
  it(statement, ()=>{
    routine();
    process.env = env;
  });
}

describe('bolt.config', ()=>{
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
  });

  describe('bolt.loadConfig()', ()=>{

  });
});