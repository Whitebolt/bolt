'use strict';

/**
 * @module bolt/bolt
 */

const __undefined = Symbol("undefined");

/**
 * Memory class for look-ups.
 *
 * @class Memory
 * @param {iterable} ...params    Iterable object that can be used in WeakSet construction.
 */
class Memory extends WeakMap {
  constructor(...params) {
    if ((params.length === 1) && Array.isArray(params[0])) {
      super(params[0]);
    } else {
      super(params);
    }
  }

  /**
   * Get a value from a map for a reference object.
   *
   * @param {Object|Function} ref   Reference object.
   * @param {string} key            Key to lookup against ref object.
   * @returns {*}                   The key value.
   */
  get(ref, key=__undefined) {
    if (!super.has(ref)) super.set(ref, new Map());
    if (key === __undefined) return super.get(ref);
    return super.get(ref).get(key);
  }

  /**
   * Set a value against a map, against a reference object.
   *
   * @param {Object|Function} ref   Reference object.
   * @param {*} value               The key value.
   * @param {string} key            Key to set lookup against ref object.
   * @returns {*}                   The value set.
   */
  set(ref, value, key) {
    if (!super.has(ref)) super.set(ref, new Map());
    super.get(ref).set(key, value);
    return this.get(ref, key);
  }

  /**
   * Test given key in map for reference object.
   *
   * @param {Object|Function} ref   Reference object.
   * @param {string} key            Key to set lookup against ref object.
   * @returns {Boolean}             Does map connected to ref object have given key?
   */
  has(ref, key) {
    if (!super.has(ref)) super.set(ref, new Map());
    return super.get(ref).has(key);
  }
}

module.exports = {
  Memory
};