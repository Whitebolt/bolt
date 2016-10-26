const chai = require('chai');
const assert = chai.assert;
const string = require(getFilePathForSubject('string'));

global.boltAppID = string.randomString();

global.bolt = Object.assign(
  require('lodash'),
  require(getFilePathForSubject()),
  require(getFilePathForSubject('bolt'))
);

function getFilePathForSubject(fileName=__filename) {
  return process.cwd() + __dirname.replace(new RegExp('^' + process.cwd() + '/test'), '') + '/' + fileName.split('/').pop();
}

describe('bolt.bolt', ()=>{
  it('Should throw if boltAppId not defined', ()=>{
    assert.equal(bolt.setDefault('TEST','HELLO WORLD'), 'HELLO WORLD');
    let temp = global.boltAppID;
    delete global.boltAppID;
    assert.throws(()=>bolt.getDefault('TEST'), ReferenceError);
    global.boltAppID = temp;
  });

  describe('bolt.setDefault()', ()=>{
    it('Setting a value should return the value.', ()=>{
      assert.equal(bolt.setDefault('TEST','HELLO WORLD'), 'HELLO WORLD');
    });

    it('Values should set and then be gettable.', ()=>{
      bolt.setDefault('TEST','HELLO WORLD');
      assert.equal(bolt.getDefault('TEST'), 'HELLO WORLD');
    });

    it('Values should of different types should be allowable.', ()=>{
      [{}, 1, 1.7, true, false, []].forEach(key=>{
        bolt.setDefault(key,'HELLO WORLD');
        assert.equal(bolt.getDefault(key), 'HELLO WORLD');
      })
    });

    it('Values should set within the app space.', ()=>{
      bolt.setDefault('TEST','HELLO WORLD');
      assert.equal(bolt.getDefault('TEST'), 'HELLO WORLD');
      let temp = global.boltAppID;
      global.boltAppID = 'TEST';
      bolt.setDefault('TEST','NOT HELLO WORLD');
      assert.equal(bolt.getDefault('TEST'), 'NOT HELLO WORLD');
      global.boltAppID = temp;
      assert.equal(bolt.getDefault('TEST'), 'HELLO WORLD');
    });

    it('Should throw if key not defined', ()=>{
      assert.throws(()=>bolt.getDefault('TEST2'), ReferenceError);
    });
  });

  describe('bolt.getDefault()', ()=>{
    it('Set values should be gettable.', ()=>{
      bolt.setDefault('TEST','HELLO WORLD');
      assert.equal(bolt.getDefault('TEST'), 'HELLO WORLD');
    });
  });

  describe('bolt.hasDefault()', ()=>{
    it('Should return true for set keys and false for unset keys.', ()=>{
      bolt.setDefault('TEST','HELLO WORLD');
      assert.isTrue(bolt.hasDefault('TEST'));
      assert.isFalse(bolt.hasDefault('TEST2'));
    });
  });

  describe('bolt.deleteDefault()', ()=>{
    it('Should delete defaults.', ()=>{
      bolt.setDefault('TEST','HELLO WORLD');
      bolt.deleteDefault('TEST');
      assert.throws(()=>bolt.getDefault('TEST'), ReferenceError);
    });
  });

  describe('bolt.watchDefault()', ()=>{
    it('Should watch changes to defaults.', done=>{
      let count = 0;
      let changes = 0;

      bolt.watchDefault('WATCHME',()=>count++);
      bolt.watchDefault('WATCHME',()=>count++);
      bolt.watchDefault('WATCHME',()=>{
        assert.equal(count, 2);
        count = 0;
        changes++;
        if (changes >= 2) done();
      });

      bolt.setDefault('WATCHME', 5);
      bolt.setDefault('WATCHME', 7);
    });

    it('Should fire watchers with old and new values.', done=>{
      let count = 0;

      bolt.watchDefault('WATCHME2',(value, oldValue)=>{
        count++;
        if (count > 1) {
          assert.equal(value, 7);
          assert.equal(oldValue, 5);
          done();
        } else {
          assert.equal(value, 5);
          assert.isUndefined(oldValue);
        }
      });

      bolt.setDefault('WATCHME2', 5);
      bolt.setDefault('WATCHME2', 7);
    });
  });

  it('Should return an unset() function.', done=>{
    let count = 0;

    bolt.watchDefault('WATCHME3',()=>count++);
    let unset = bolt.watchDefault('WATCHME3',()=>count++);
    unset();
    bolt.watchDefault('WATCHME3',()=>{
      assert.equal(count, 1);
      done();
    });
    bolt.setDefault('WATCHME3', 7);
  });

  describe('bolt.hasDefaultWatcher()', ()=>{
    it('Should test if any watchers set.', ()=>{
      assert.isFalse(bolt.hasDefaultWatcher('WATCHME4'));
      bolt.setDefault('WATCHME4', 7);
      assert.isTrue(bolt.hasDefaultWatcher('WATCHME4'));
    });
  });
});