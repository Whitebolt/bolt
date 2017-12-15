'use strict';

const React = require("react");
const ReactDomServer = require("react-dom/server");

module.exports = function() {
  // @annotation key moduleSetScopeJsx

  bolt.ReactBolt = bolt.ReactBolt  || {};

  return event=>{
    event.scope.React = React;
    event.scope.ReactDOMServer = ReactDomServer;
    event.scope.ReactBolt = bolt.ReactBolt;
  }
};