#!/usr/bin/env node

import { serve } from '@hono/node-server';
import { createApp } from '../lib/server.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const staticDir = join(import.meta.dirname, '..', 'dist');
const serveWeb = process.env.DIRGEST_SERVE_WEB !== 'false' && existsSync(staticDir);

const port = Number(process.env.PORT) || 3940;
const validApiKeys = process.env.DIRGEST_API_KEYS ? process.env.DIRGEST_API_KEYS.split(',').map((k) => k.trim()).filter(Boolean) : [];
const rateLimitWindow = Number(process.env.DIRGEST_RATE_LIMIT_WINDOW) || 60_000;
const rateLimitMax = Number(process.env.DIRGEST_RATE_LIMIT_MAX) || 60;

const { app } = createApp({
  validApiKeys,
  rateLimit: { windowMs: rateLimitWindow, maxRequests: rateLimitMax },
  staticDir: serveWeb ? staticDir : undefined,
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`dirgest-api listening on http://localhost:${info.port}`);
  console.log(`  version: v1`);
  console.log(`  auth: ${validApiKeys.length ? 'enabled' : 'open (set DIRGEST_API_KEYS to require keys)'}`);
  console.log(`  rate limit: ${rateLimitMax} requests / ${rateLimitWindow / 1000}s`);
});
