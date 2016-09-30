const chai = require('chai');
const assert = chai.assert;

global.bolt = Object.assign(
  require('lodash'),
  require(getFilePathForSubject())
);

function getFilePathForSubject(fileName=__filename) {
  return process.cwd() + __dirname.replace(new RegExp('^' + process.cwd() + '/test'), '') + '/' + fileName.split('/').pop();
}

describe('bolt.array', ()=>{
  describe('bolt.makeArray()', ()=>{
    it('Should convert non-arrays to array', ()=>{
      assert.isArray(bolt.makeArray(1));
      assert.isArray(bolt.makeArray("1"));
      assert.isArray(bolt.makeArray({}));
      assert.isArray(bolt.makeArray(null));
      assert.deepEqual(bolt.makeArray(1), [1]);
      assert.deepEqual(bolt.makeArray("1"), ["1"]);
      assert.deepEqual(bolt.makeArray({}), [{}]);
      assert.deepEqual(bolt.makeArray({1:"test"}), [{1:"test"}]);
      assert.deepEqual(bolt.makeArray(null), [null]);
    });

    it('Should not convert if already an array', ()=>{
      assert.deepEqual(bolt.makeArray([1]), [1]);
      assert.deepEqual(bolt.makeArray([1,2,3,4]), [1,2,3,4]);

      let testArray1 = [1,2,3,4];
      let testArray2 = bolt.makeArray(testArray1);
      testArray1[0] = 0;

      assert.deepEqual(testArray1, testArray2);
    });

    it('Should not convert undefined to an empty array', ()=>{
      assert.isArray(bolt.makeArray(undefined));
      assert.equal(bolt.makeArray(undefined).length, 0);
    });

    it('Should use convert function if supplied is not an array', ()=>{
      const convertFunc = (ary)=>'TEST';

      assert.deepEqual(bolt.makeArray([1], convertFunc), [1]);
      assert.deepEqual(bolt.makeArray([1,2,3,4], convertFunc), [1,2,3,4]);
      assert.equal(bolt.makeArray(1, convertFunc), 'TEST');
    });
  });

  describe('bolt.prioritySorter()', ()=>{
    it('Should return 1 when priority of first value greater than second.', ()=>{
      assert.equal(bolt.prioritySorter({priority:2},{priority:1}), 1);
    });
    it('Should return -1 when priority of first value less than second.', ()=>{
      assert.equal(bolt.prioritySorter({priority:1},{priority:2}), -1);
    });
    it('Should return 0 when priority of first value equal to the second.', ()=>{
      assert.equal(bolt.prioritySorter({priority:2},{priority:2}), 0);
    });

    it('Should sort an array according to priority property when used as sort function.', ()=>{
      const unsorted = [
        {priority:5}, {priority:1}, {priority:2}, {priority:10}, {priority:-1}
      ];
      const sorted = [
        {priority:-1}, {priority:1}, {priority:2}, {priority:5}, {priority:10}
      ];

      assert.deepEqual(unsorted.sort(bolt.prioritySorter), sorted);
    });

    it('Should assume a priority of 0 when non present.', ()=>{
      const unsorted = [
        {priority:5}, {priority:1}, {_priority:2}, {priority:10}, {}
      ];
      const sorted = [
        {_priority:2}, {}, {priority:1}, {priority:5}, {priority:10}
      ];
      assert.deepEqual(unsorted.sort(bolt.prioritySorter), sorted);
    });

    it('Supplying one argument as a string should build a new sorter with supplied argument as the sort property.', ()=>{
      const sorter = bolt.prioritySorter('_priority');
      const unsorted = [
        {_priority:5}, {_priority:1}, {_priority:2}, {_priority:10}, {_priority:-1}
      ];
      const sorted = [
        {_priority:-1}, {_priority:1}, {_priority:2}, {_priority:5}, {_priority:10}
      ];

      assert.isFunction(sorter);
      assert.deepEqual(unsorted.sort(sorter), sorted);
    });

    it('Supplying one argument as a an object should build a new sorter taking the sortProperty as the property name to sort on.', ()=>{
      const sorter = bolt.prioritySorter({sortProperty:'_priority'});
      const unsorted = [
        {_priority:5}, {_priority:1}, {_priority:2}, {_priority:10}, {_priority:-1}
      ];
      const sorted = [
        {_priority:-1}, {_priority:1}, {_priority:2}, {_priority:5}, {_priority:10}
      ];

      assert.isFunction(sorter);
      assert.deepEqual(unsorted.sort(sorter), sorted);
    });

    it('Supplying one argument as a an object should build a new sorter taking the sortProperty as the property name to sort on and direction as the search direction.', ()=>{
      const sorterAsc = bolt.prioritySorter({sortProperty:'_priority', direction:'ASC'});
      const sorterDesc = bolt.prioritySorter({sortProperty:'_priority', direction:'DESC'});
      const unsorted = [
        {_priority:5}, {_priority:1}, {_priority:2}, {_priority:10}, {_priority:-1}
      ];
      const sortedAsc = [
        {_priority:-1}, {_priority:1}, {_priority:2}, {_priority:5}, {_priority:10}
      ];
      const sortedDesc = bolt.clone(sortedAsc).reverse();

      assert.isFunction(sorterAsc);
      assert.isFunction(sorterDesc);
      assert.deepEqual(unsorted.sort(sorterAsc), sortedAsc);
      assert.deepEqual(unsorted.sort(sorterDesc), sortedDesc);
    });

    it('Throws when no arguments supplied', ()=>{
      assert.throws(()=>bolt.prioritySorter(), SyntaxError);
      assert.throws(()=>bolt.prioritySorter(), 'No arguments supplied to prioritySorter()');
    });

    it('Throws when one argument supplied and it is neither an object or a string.', ()=>{
      assert.throws(()=>bolt.prioritySorter(1), TypeError);
      assert.throws(()=>bolt.prioritySorter(1), 'Wrong argument type supplied as first parameter for prioritySorter()');
      assert.throws(()=>bolt.prioritySorter(null), 'Wrong argument type supplied as first parameter for prioritySorter()');
    });

    it('Throws when one argument supplied and direction is neither ASC or DESC', ()=>{
      assert.throws(()=>bolt.prioritySorter({direction:'EQUAL'}), RangeError);
      assert.throws(()=>bolt.prioritySorter({direction:'EQUAL'}), 'Sort direction for prioritySorter() should be either ASC or DESC');
    });
  });

  describe('bolt.indexOfEquiv()', ()=>{
    it('Will search array returning matching index.', ()=>{
      assert.equal(bolt.indexOfEquiv([1,2,3,4,5], 3), 2);
      assert.equal(bolt.indexOfEquiv([1,'two',3,4,5], 'two'), 1);
    });

    it('Will return -1 if not found.', ()=>{
      assert.equal(bolt.indexOfEquiv([1,2,3,4,5], 0), -1);
      assert.equal(bolt.indexOfEquiv([1,2,3,4,5], 'two'), -1);
    });

    it('Will perform equivalence matching.', ()=>{
      assert.equal(bolt.indexOfEquiv([1,2,null,4,5], null), 2);
      assert.equal(bolt.indexOfEquiv([1,{hello:'world'},3,4,5], {hello:'world'}), 1);
      assert.equal(bolt.indexOfEquiv([1,{hello:'world'},3,4,5], {}), -1);
    });
  });
});