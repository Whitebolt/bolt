'use strict';

/**
 * @module bolt/bolt
 */

const Promise = require('bluebird');

const events = new Map();
const topics = new Map();
const hooks = new Map();
const idLookup = new WeakMap();
const done = new WeakMap();
const reverseLookup = new Map();

const defaultOptions = {priority:0, context:{}};

idLookup.set(events, new Map());
idLookup.set(topics, new Map());
idLookup.set(hooks, new Map());

done.set(events, new Map());
done.set(topics, new Map());
done.set(hooks, new Map());

reverseLookup.set("events", events);
reverseLookup.set("topics", topics);
reverseLookup.set("hooks", hooks);

/**
 * Connect to specified hook.  Hooks are run in-sequence as a hook is fired from
 * the bolt server.  This is different to an event, which will run at some
 * undefined point after the event is fired.  The server will wait for hooks to
 * return before continuing to the next operation.
 *
 * @public
 * @param {string} hookName                 Hook name to connect to.
 * @param {Function} hookFunction           Hook function to call.
 * @param {Object} [options=defaultOptions] Params to pass to the hook caller.
 */
function hook(hookName, hookFunction, options) {
  let _options = Object.assign({}, defaultOptions, options || {});
  return _on(hookName, hookFunction, _options, hooks);
}

/**
 * Connect to a specific event.  Events will fire and then the code continues
 * not waiting for connected functions to run.  These functions will run when
 * server is able to process them.
 *
 * @public
 * @param {string} eventName                Hook name to connect to.
 * @param {Function} eventCallback          Hook function to call.
 * @param {Object} [options=defaultOptions] Params to pass to the event caller.
 */
function on(eventName, eventCallback, options) {
  let _options = Object.assign({}, defaultOptions, options || {});
  return _on(eventName, eventCallback, _options, events);
}

/**
 * Connect to a specific event once.  The same as on but only fires once and
 * never again.
 *
 * @public
 * @param {string} eventName                Hook name to connect to.
 * @param {Function} eventCallback          Hook function to call.
 * @param {Object} [options=defaultOptions] Params to pass to the event caller.
 */
function once(eventName, eventCallback, options) {
  let _options = Object.assign({}, defaultOptions, options || {});
  let unreg = on(eventName, (..._params) => {
    unreg();
    return eventCallback.apply(_options.context || {}, _params);
  }, _options);
}

/**
 * Subscribe to a specific topic.  Topics are not the same as events or hooks.
 * Events and hooks are about stuff that has happened, topics are designed for
 * data streams.  Although, events and topics could be used inter-changeably,
 * they exist separately so streaming data has it's own methods.
 *
 * A good example of a topic might be the event log itself, one method could
 * subscribe to this stream to output to the console;  another method might
 * link the same stream to web-socket to be streamed to an admin users
 * browser console.
 *
 * Topic also, have a hierarchy so messages submitted on channel /A/AA/AAA will
 * be heard by handlers for /A, /A/AA and /A/AA/AAA.
 *
 * @note All topics will also fire a hook of the same name; so, you can hook into
 * topics; although, you would normally only hook into events.
 *
 * @public
 * @param {string} topicName                Topic name to subscribe to.
 * @param {Function} topicHandler           Handler function to fire on
 *                                          topic data.
 * @param {Object} [options=defaultOptions] Params to pass to the topic caller.
 */
function subscribe(topicName, topicHandler, options) {
  let _options = Object.assign({}, defaultOptions, options || {});
  return _on(topicName, topicHandler, _options, topics);
}

/**
 * Switch off any subscriptions for given event/hook/topic for given type.
 *
 * @public
 * @param {string} hookName                             Hookname(s) to
 *                                                      unsuscribe from. Hooks
 *                                                      seperated by commas.
 * @param {string} [hookTypes=[events, topics, hooks]]  The event type to
 *                                                      unsubscribe from
 *                                                      (event, topic,
 *                                                      or hook). Types
 *                                                      seperated by commas.
 */
function off(hookName, hookTypes) {
  let hookNames = bolt.splitAndTrim(hookName, ',');
  (hookTypes ?
    bolt.splitAndTrim(hookTypes.toLowerCase(), '/').map(hookType=>reverseLookup.get(hookType)) :
    reverseLookup
  ).forEach(lookup=>{
    hookNames.forEach(hookName=>{
      if (lookup.has(hookName)) lookup.delete(hookName);
    });
  });
}

/**
 * Fire a specified event/hook, passing the given params to any
 * subscribed functions.  Here events and hooks are the same.  Any fired
 * data here can be connected to via either or 'on' or 'hook'; the only
 * difference is whether fire waits for a return before continuing. Fire waits
 * for hooks but not ons.
 *
 * If a function is passed in then fire a before and after event with the
 * supplied function executing between them. So if you have an function
 * passed-in with a hookName of 'init': fire 'beforeInit', fire the function,
 * then fire 'afterInit'.  The resolved value of the function is also passed
 * onto the end of the parameters to the after event. The passed function
 * should return a promise.
 *
 * @public
 * @param {string|Function}   hookName  Hook name to fire. If a function is
 *                                      passed, assume a call-through is
 *                                      required and receive the hookname from
 *                                      the first item in the params array.
 * @param {Array} ...params             Parameters to pass to the subscribed
 *                                      functions.
 * @returns {Promise}                   Promise fulfilled when all hooks fired.
 *                                      The in-sequence running will only work
 *                                      if you wait for this promise to return.
 */
function fire(hookName, ...params) {
  let [caller, _hookName] = _getCallerAndEventName(hookName, params);
  return (
    caller ?
      _fireThrough(_hookName, caller, params, events) :
      _fire(_hookName, params, events)
  );
}

/**
 * Test whether a hook (or event/topic) has fired at least once. If a hook has
 * already fired you may actually want to run the callback instead of setting
 * it as an on.
 *
 * @todo  Provide a means of always firing a hook when hook already fired or waiting till it fires if not.
 *
 * @param {string} hookName         The hook name to test.
 * @param {string} [type='hooks']   Type of event (hooks|events|topics).
 * @returns {boolean}               Has it fired.
 */
function fired(hookName, type='hooks') {
  if (reverseLookup.has(type)) {
    let lookup = reverseLookup.get(type);
    if (done.get(lookup).has(hookName)) return true;
  }
  return false;
}

/**
 * Stream the given data via the given topic channel.
 *
 * If a function is passed in then fire a before and after event with the
 * supplied function executing between them. So if you have an function
 * passed-in with a hookName of 'init': fire 'beforeInit', fire the function,
 * then fire 'afterInit'.  The resolved value of the function is also passed
 * onto the end of the parameters to the after event. The passed function
 * should return a promise.
 *
 * @public
 * @param {string|Function} topicName   Topic name to fire. If a function is
 *                                      passed, assume a call-through is
 *                                      required and receive the topic name
 *                                      from the first item in the
 *                                      params array.
 * @param {Array} ...params                Parameters to pass to the subscribed
 *                                      functions.
 * @returns {Promise}                   Promise fulfilled when all hooks fired.
 *                                      The in-sequence running will only work
 *                                      if you wait for this promise to return.
 */
function broadcast(topicName, ...params) {
  let [callThrough, _topicName] = _getCallerAndEventName(topicName, params);
  let topicNames = _getTopicNames(_topicName);
  return Promise.all(topicNames.map(topicName=>(callThrough ?
      _fireThrough(topicName, callThrough, params, topics) :
      _fire(topicName, params, topics)
  )));
}

/**
 * Retrieve the eventName and call-through function.
 *
 * @private
 * @param eventName {string|Function}                 The event name or call-
 *                                                    through function.
 * @param params {Array}                              Parameters to pass to
 *                                                    the event.
 * @returns {Array}   The calculated event
 *                                                    name nd call-through.
 */
function _getCallerAndEventName(eventName, params) {
  let callThrough;
  if (bolt.isFunction(eventName) && params.length) {
    callThrough = eventName;
    eventName = params.shift();
  }

  return [callThrough, eventName];
}

/**
 * Get topic names to broadcast on.  These are hierarchy channels, so:
 * /A/AA/AAA will return [/A, /A/AA, /A/AA/AAA].
 *
 * @private
 * @param {string} topicName  Name to retreive topics from.
 * @returns {Array}           Topic for supplied channel.
 */
function _getTopicNames(topicName) {
  let topicPath = bolt.splitAndTrim(topicName, '/');
  let topicNames = [];
  while (topicPath.length) {
    topicNames.push('/' + topicPath.join('/'));
    topicPath.pop();
  }

  return topicNames;
}

/**
 * Setup a subscription for a specific hook, event or topic with given handler
 * function and options.
 *
 * @private
 * @param {string} hookName     Hook/Event/Topic name to connect to.
 * @param {Function} handler    Handler function to call when hook, event or
 *                              topic is fired.
 * @param {Object} options      Options object for this on setup.
 * @param {Map} lookup          Map object to lookup handlers in.
 * @returns {Function}          An unregister function for this connection.
 */
function _on(hookName, handler, options, lookup) {
  let id = _onCreate(hookName, handler, options, lookup);
  return _onCreateUnregister(hookName, lookup, id);
}

/**
 * Create an on handler for _on.
 *
 * @private
 * @param {string} hookName     Hook/Event/Topic name to connect to.
 * @param {Function} handler    Handler function to call when hook, event or
 *                              topic is fired.
 * @param {Object} options      Options object for this on setup.
 * @param {Map} lookup          Map object to lookup handlers in.
 * @returns {string}            A id for this specific on.
 */
function _onCreate(hookName, handler, options, lookup) {
  if (!lookup.has(hookName)) lookup.set(hookName, []);
  let hooks = lookup.get(hookName);
  let id = options.id || bolt.randomString(32);
  let _idLookup = _getIdLookup(hookName, lookup);
  if (!_idLookup.has(id)) {
    _idLookup.set(id, true);
    hooks.push({handler, options, id});
    lookup.set(hookName, hooks.sort(_hookPrioritySorter));
  }
  return id;
}

/**
 * Get the id lookup map for given lookup object and hook name.
 *
 * @private
 * @param {string} hookName   The hook name to lookup.
 * @param {Object} lookup     The lookup map to lookup.
 * @returns {Map}             The id lookup Map.
 */
function _getIdLookup(hookName, lookup) {
  let _idLookup = idLookup.get(lookup);
  if (!_idLookup.has(hookName)) _idLookup.set(hookName, new Map());
  return _idLookup.get(hookName);
}

/**
 * Create a function for unregistering a specific on.
 *
 * @private
 * @param {string} hookName     Hook/Event/Topic name to connect to.
 * @param {Map} lookup          Map object to lookup handlers in.
 * @param {string} id           Id of on to unregister.
 * @returns {Function}          The unregister function.
 */
function _onCreateUnregister(hookName, lookup, id) {
  return ()=>{
    let hooks = lookup.get(hookName);
    hooks = hooks.filter(hook=>(hook.id !== id));
    lookup.set(hookName, hooks);
  };
}

/**
 * Sorter for an array of hooks or events according to their priority.  This is
 * not so important with events which are run as and when.  However, specific
 * order could be vital with hooks.
 *
 * @param {number} a          First array item to compare.
 * @param {number} b          Second array item to compare.
 * @returns {number} [-1|0|1] Calculated order for a and b.
 * @private
 */
function _hookPrioritySorter(a, b) {
  return bolt.prioritySorter(a, b);
}

/**
 * Fire a given hook/event/topic with the given parameters. Hooks are fired
 * in-sequence where-as events and topics are fired as and when.
 *
 * @private
 * @param {string} hookName Event(s), Hook(s) or Topic(s) to fire.
 * @param {Array} params    Parameters to pass to any handlers.
 * @param {Map} lookup      Lookup to use (either topics or events - never
 *                          hooks as this is always fired).
 * @returns {Promise}       The promise fulfilled when all hooks fired.
 */
function _fire(hookName, params, lookup) {
  return Promise.all(bolt.splitAndTrim(hookName, ',').map(hookName=>{
    process.nextTick(()=>{
      done.get(lookup).set(hookName, true);
      _fireEvents(hookName, params, lookup);
    });
    return _fireHooks(hookName, params);
  }));
}

/**
 * Fire an event/topic/hook through a function.  So if I have function and a
 * hookname: fire a before event, fire the function, then fire an after event.
 * The resolved value of the function is also passed onto the end of the
 * parameters to the after event. The passed function should return a promise.
 *
 * @private
 * @param {string} hookName         The hook name(s).
 * @param {Function} callThrough    The call-through function.
 * @param {Array} params            The params to pass.
 * @param {Map} lookup              The events/hooks/topics lookup map to use.
 * @returns {Promise}               Promise resolved after call-through done
 *                                  both the before and after events fired.
 */
function _fireThrough(hookName, callThrough, params, lookup) {
  hookName = bolt.splitAndTrim(hookName, ',');
  let beforeHookName = hookName.map(hookName=>'before'+bolt.upperFirst(hookName)).join(',');
  let afterHookName = hookName.map(hookName=>'after'+bolt.upperFirst(hookName)).join(',');

  return _fire(beforeHookName, params, lookup).then(callThrough).then(value=>{
    let _params = bolt.clone(params);
    _params.push(value);
    return _fire(afterHookName, _params, lookup).then(_value=>value);
  });
}

/**
 * Fire a given event or topic with the given parameters passed to the handler.
 *
 * @private
 * @param {string} hookName Event, Hook or Topic to fire.
 * @param {Array} params    Parameters to pass to any handlers.
 * @param {Map} lookup      Lookup to use (either topics or events - never
 *                          hooks as this is always fired).
 */
function _fireEvents(hookName, params, lookup) {
  if (lookup.has(hookName)) {
    lookup.get(hookName).forEach(hook => {
      process.nextTick(()=>hook.handler.apply(
        hook.options.context ||{},
        [hook.options].concat(params.slice())
      ));
    });
  }
}

/**
 * Fire a given hook with given parameters passed to the handler.
 *
 * @private
 * @param {string} hookName Event, Hook or Topic to fire.
 * @param {Array} params    Parameters to pass to any handlers.
 * @returns {Promise}       Promise fulfilled when all hooks fired.  The
 *                          in-sequence running will only work if you wait
 *                          for this promise to return.
 */
function _fireHooks(hookName, params) {
  if (hooks.has(hookName)) {
    done.get(hooks).set(hookName, true);
    return Promise.all(hooks
      .get(hookName)
      .map(hook =>
        hook.handler.apply(hook.options.context || {}, [hook.options].concat(params.slice()))
      )
    );
  }
  return Promise.resolve()
}

module.exports = {
  on, once, hook, subscribe, off, fire, broadcast, fired, _eventDefaultParams: defaultOptions
};