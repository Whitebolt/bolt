'use strict';

const frozen = new WeakSet();

/**
 * @class FreezeSetException
 *
 * Error for freeze sets when one tries to add/delete/clear on a frozen set.
 */
class FreezeSetException extends TypeError {
  constructor(...params) {
    super.apply(this, params);
  }
}

/**
 * A set, which can be frozen. Once the freeze method is called, no other values can be added or removed.
 *
 * @class
 * @extends Set
 */
class FreezeSet extends Set {
  constructor(...params) {
    if ((params.length === 1) && Array.isArray(params[0])) {
      super(params[0]);
    } else {
      super(params);
    }
  }

  /**
   * The FreezeSetException class used in this class.
   *
   * @returns {FreezeSetException}
   */
  static get FreezeSetException() {
    return FreezeSetException;
  }

  /**
   * Add a value to the set f set is not frozen.
   *
   * @throws FreezeSetException
   * @param {*} value     Value to set.
   * @returns {*}         The set value.
   */
  add(value) {
    if (!frozen.has(this)) return super.add(value);
    throw new FreezeSet.FreezeSetException('Cannot add to a frozen set.');
  }

  /**
   * Clear the set if set is not frozen.
   *
   * @throws FreezeSetException
   * @returns {undefined}     Result of set clear (is undefined).
   */
  clear() {
    if (!frozen.has(this)) return super.clear();
    throw new FreezeSet.FreezeSetException('Cannot clear a frozen set.');
  }

  /**
   * Delete a set value if it is not frozen.
   *
   * @throws FreezeSetException
   * @param {*} value     Value to delete from set.
   * @returns {boolean}   Did the value clear?
   */
  delete(value) {
    if (!frozen.has(this)) return super.delete(value);
    throw new FreezeSet.FreezeSetException('Cannot delete a value on a frozen set.');
  }

  /**
   * Freeze the set.
   *
   * @returns {boolean}   Did the set freeze?
   */
  freeze() {
    frozen.add(this);
    return true;
  }
}

module.exports = {
  FreezeSet
};
