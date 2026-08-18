import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from '@hono/node-server/serve-static';
import { ProjectCache } from './project-cache.js';
import { JobStore } from './jobs.js';
import { createRoutes } from './routes.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const API_VERSION = 'v1';

export function createApp(options = {}) {
  const { validApiKeys = [], rateLimit = {}, staticDir } = options;
  const cache = new ProjectCache();
  const jobs = new JobStore();
  const app = new Hono();

  app.use('/api/*', logger());
  app.use('/api/*', cors());
  app.use('/api/*', authMiddleware(validApiKeys));
  app.use('/api/*', rateLimitMiddleware(rateLimit));

  app.get('/healthz', (c) => c.json({ ok: true, version: API_VERSION }));

  const routes = createRoutes(cache, jobs);
  app.route(`/api/${API_VERSION}`, routes);

  if (staticDir && existsSync(staticDir)) {
    app.use('/*', serveStatic({ root: staticDir }));
    app.get('/*', serveStatic({ path: join(staticDir, 'index.html') }));
  }

  app.onError((error, c) => {
    console.error('Unhandled error:', error);
    return c.json({ ok: false, error: { code: 'internal', message: 'An internal error occurred.' }, meta: { version: API_VERSION, timestamp: new Date().toISOString() } }, 500);
  });

  app.notFound((c) => c.json({ ok: false, error: { code: 'not-found', message: `Route not found: ${c.req.method} ${c.req.path}` }, meta: { version: API_VERSION, timestamp: new Date().toISOString() } }, 404));

  return { app, cache, jobs };
}
