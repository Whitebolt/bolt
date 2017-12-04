'use strict';

/**
 * Setup ready callback.
 *
 * @private
 * @returns {Function}      The ready function to fire all on ready events.
 */
function getReady(bolt, boltLoaded) {
  const readyCallbacks = new Set();

  bolt.ready = (hook, handler=hook)=>{
    const _handler = ((hook !== handler) ? ()=>bolt.emit(hook, handler) : handler);

    if (!boltLoaded()) {
      readyCallbacks.add(_handler);
      return ()=>readyCallbacks.delete(_handler);
    } else {
      _handler();
      return ()=>{};
    }
  };

  return ()=>{
    readyCallbacks.forEach(handler=>handler());
    readyCallbacks.clear();
  }
}

module.exports = getReady;