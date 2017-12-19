'use strict';

const React = require("react");
const ReactDomServer = require("react-dom/server");
const Redux = require("redux");

module.exports = function() {
	// @annotation key moduleSetScopeJsx

	const ReduxBolt = bolt.ReduxBolt || {
		actionCreators:[],
		reducers:[],
		types:[],
		dispatch: (actionCreator, ...params)=>{
			if (Redux && ReduxBolt && (actionCreator in ReduxBolt.actionCreators)) {
				Redux.dispatch(ReduxBolt.actionCreators[actionCreator](...params));
			}
		}
	};

	bolt.ReactBolt = bolt.ReactBolt  || {};
	bolt.ReduxBolt = ReduxBolt;

	return event=>{
		event.scope.React = React;
		event.scope.Redux = Redux;
		event.scope.ReactDOMServer = ReactDomServer;
		event.scope.ReactBolt = bolt.ReactBolt;
		event.scope.ReduxBolt = bolt.ReduxBolt;
	}
};