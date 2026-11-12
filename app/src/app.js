const path = require('node:path');
const express = require('express');
const defaultConfig = require('./config');
const { openDatabase } = require('./db');
const { TokenStore } = require('./services/tokens');
const { EventBus } = require('./services/events');
const { securityHeaders } = require('./middleware/securityHeaders');
const { authenticate, requireRole } = require('./middleware/auth');
const { createChaos } = require('./middleware/chaos');
const { notFound, errorHandler } = require('./middleware/errors');

function createApp(overrides = {}) {
  const config = { ...defaultConfig, ...overrides };
  const db = overrides.db || openDatabase(config.dbPath);
  const tokenStore = new TokenStore({ ttlMinutes: config.tokenTtlMinutes });
  const eventBus = overrides.eventBus || new EventBus();
  const authenticateUser = authenticate(tokenStore, db);
  const requireAdmin = requireRole('admin');
  const deps = { db, tokenStore, eventBus, authenticateUser, requireAdmin, config };

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(securityHeaders);
  app.use(express.json({ limit: '10kb' }));

  if (config.chaosEnabled) {
    const chaos = createChaos();
    app.post('/__chaos', chaos.controlRoute);
    app.use(chaos.middleware);
    app.locals.chaos = chaos;
  }

  app.get('/api/health', (req, res) => {
    const { ok } = db.prepare('SELECT 1 AS ok').get();
    res.json({ status: ok === 1 ? 'UP' : 'DOWN', uptimeSeconds: Math.round(process.uptime()) });
  });
  app.use('/api/auth', require('./routes/auth')(deps));
  app.use('/api/products', require('./routes/products')(deps));
  app.use('/api/cart', require('./routes/cart')(deps));
  app.use('/api/orders', require('./routes/orders')(deps));
  app.use('/api', notFound);

  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir, { extensions: ['html'] }));
  app.use((req, res) => res.status(404).sendFile(path.join(publicDir, '404.html')));
  app.use(errorHandler);

  app.locals.db = db;
  app.locals.eventBus = eventBus;
  app.locals.tokenStore = tokenStore;
  return app;
}

module.exports = { createApp };
