const chai = require('chai');
const assert = chai.assert;

global.bolt = Object.assign(
  require('lodash'),
  require(getFilePathForSubject()),
  require(getFilePathForSubject('array')),
  require(getFilePathForSubject('bolt'))
);

function getFilePathForSubject(fileName=__filename) {
  return process.cwd() + __dirname.replace(new RegExp('^' + process.cwd() + '/test'), '') + '/' + fileName.split('/').pop();
}

describe('bolt.array', ()=>{
  describe('bolt.toBool()', ()=>{
    it('Should set boolean conversion defaults correctly.', ()=> {
      assert.deepEqual(bolt.getDefault('bool.true'), ['true', 'yes', 'on']);
      assert.deepEqual(bolt.getDefault('bool.false'), ['false', 'no', 'off']);
    });

    it('Should convert to true or false for default conversion values.', ()=> {
      assert.isBoolean(bolt.toBool('true'));
      assert.isBoolean(bolt.toBool('yes'));
      assert.isBoolean(bolt.toBool('on'));
      assert.equal(bolt.toBool('true'), true);
      assert.equal(bolt.toBool('yes'), true);
      assert.equal(bolt.toBool('on'), true);

      assert.isBoolean(bolt.toBool('false'));
      assert.isBoolean(bolt.toBool('no'));
      assert.isBoolean(bolt.toBool('off'));
      assert.equal(bolt.toBool('false'), false);
      assert.equal(bolt.toBool('no'), false);
      assert.equal(bolt.toBool('off'), false);
    });

    it('Should return the value when it cannot convert it.', ()=> {
      assert.equal(bolt.toBool(null), null);
      assert.equal(bolt.toBool(1), 1);
    });

    it('Should use different defaults if supplied as params.', ()=> {
      assert.isBoolean(bolt.toBool(null, [null], [undefined]));
      assert.equal(bolt.toBool(null, [null], [undefined]), true);
      assert.equal(bolt.toBool(null, [1], [undefined, 2, null]), false);
      assert.notEqual(bolt.toBool('off', [1], [undefined, 2, null]), false);
      assert.equal(bolt.toBool('off', [1], [undefined, 2, null]), 'off');
    });

    it('Should fallback to global defaults for false if two arguments are given.', ()=> {
      assert.isBoolean(bolt.toBool('off', [null]));
      assert.equal(bolt.toBool('off', [null]), false);
    });

    it('Should use different defaults if the global default is changed.', ()=> {
      bolt.setDefault('bool.true', [null]);
      bolt.setDefault('bool.false', [undefined]);

      assert.isBoolean(bolt.toBool(null));
      assert.equal(bolt.toBool(null), true);

      assert.isBoolean(bolt.toBool(undefined));
      assert.equal(bolt.toBool(undefined), false);
    });
  });
});