import express from 'express';
import helmet from 'helmet';
import { randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { pool as defaultPool } from './core/database.js';
import { loadConfig } from './core/config.js';
import { checkSchema } from './core/schema.js';
import { errorHandler, fail } from './core/errors.js';
import { featureRegistry, guards, validateModules } from './core/registry.js';
import { sessionMiddleware, csrfCheck, authenticated, rateLimit } from './modules/identity/session.js';
import { createMailer } from './modules/identity/mail.js';
import { identityRoutes } from './modules/identity/routes.js';
import { companyRoutes } from './modules/company/routes.js';
import { employeeRoutes } from './modules/employees/routes.js';
import { dashboardRoutes } from './modules/dashboard/routes.js';

export function createApp({ pool = defaultPool, config = loadConfig(), mailer = createMailer(config), logger } = {}) {
  validateModules(config.modules);
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');
  app.set('trust proxy', config.trustProxyHops || false);
  app.use(helmet({ strictTransportSecurity: config.production ? undefined : false }));
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set('X-Request-ID', req.requestId);
    res.set('Cache-Control', 'private, no-store');
    res.set('Referrer-Policy', 'no-referrer');
    if (logger) {
      const started = Date.now();
      res.on('finish', () => logger({ requestId: req.requestId, method: req.method, status: res.statusCode, durationMs: Date.now() - started }));
    }
    next();
  });
  app.get('/api/v1/health/live', (req, res) => res.json({ data: { status: 'ok' } }));
  app.get('/api/v1/health/ready', async (req, res) => {
    if (config.production) {
      const hash = value => createHash('sha256').update(value).digest();
      if (!config.readinessSecret || !timingSafeEqual(hash(req.get('X-Readiness-Key') || ''), hash(config.readinessSecret))) {
        fail(404, 'NOT_FOUND', 'Route not found');
      }
    }
    try {
      await checkSchema(pool);
      res.json({ data: { status: 'ready' } });
    } catch {
      fail(503, 'NOT_READY', 'Service is not ready');
    }
  });
  const api = express.Router();
  api.use(async (req, res, next) => {
    await rateLimit(pool, config, req, res, 'api-ip', 600, 60);
    next();
  });
  api.use(sessionMiddleware(pool, config));
  api.use(csrfCheck(config));
  api.use((req, res, next) => {
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && !req.is('application/json')) fail(415, 'JSON_REQUIRED', 'Use application/json');
    next();
  });
  api.use(express.json({ limit: '64kb', strict: true, inflate: false }));
  const context = { pool, config, mailer, guards };
  api.use('/auth', identityRoutes(context));
  api.use(authenticated);
  api.use(async (req, res, next) => {
    await rateLimit(pool, config, req, res, 'private-api', 300, 60, req.actor.id);
    next();
  });
  api.use(companyRoutes(context));
  api.use('/employees', employeeRoutes(context));
  api.use('/dashboard', dashboardRoutes(context));
  for (const module of featureRegistry) {
    if (config.modules.includes(module.name)) api.use(module.route, module.factory(context));
  }
  app.use('/api/v1', api);
  app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' }, requestId: req.requestId }));
  app.use(errorHandler);
  return app;
}
export const app = createApp();
