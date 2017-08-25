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

  app.set('trust proxy', 1);

  let sessionMiddleware = session({
    name: 'sessionId',
    secret: app.config.secret,
    cookie: {
      secure: true,
      expires: new Date(Date.now() + 60 * 60 * 1000),
      httpOnly: true
    },
    store: new MongoStore({
      db: app.dbs.main
    }),
    resave: true,
    saveUninitialized: true
  });

  app.use(sessionMiddleware, (req, res, next)=>{
    if (req.session) {
      if (req.websocket) req.session.socketId = req.websocket.id;
      if (req.session.socketId && !app.io.sockets.connected.hasOwnProperty(req.session.socketId)) delete req.session.socketId;
      req.session.save();
    }

    next();
  });
};

module.exports = init;
