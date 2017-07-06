'use strict';

const session = require('express-session');
const MongoStore = require('connect-mongo')(session);

/**
 * Create the session object using mongo store. Duplicate session to websocket routes.
 *
 * @public
 * @param {BoltApplication} app   The bolt application instance.
 */
function init(app) {
  // @annotation priority 1

  let sessionMiddleware = session({
    secret: app.config.secret,
    store: new MongoStore({
      db: app.dbs.main
    }),
    resave: true,
    saveUninitialized: true
  });

  app.use((req, res, next)=>{
    req.isWebSocket = false;
    next();
  });
  bolt.ioUse(app, (req, res, next)=>{
    req.isWebSocket = true;
    next();
  });

  bolt.use(app, sessionMiddleware, (req, res, next)=>{
    if (req.session) {
      if (req.websocket) req.session.socketId = req.websocket.id;
      if (req.session.socketId && !app.io.sockets.connected.hasOwnProperty(req.session.socketId)) delete req.session.socketId;
      req.session.save();
    }

    next();
  });
};

module.exports = init;
