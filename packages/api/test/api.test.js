import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../lib/server.js';

let app;
let tempDir;

test.beforeEach(async () => {
  ({ app } = createApp({ validApiKeys: [], rateLimit: { windowMs: 60_000, maxRequests: 1000 } }));
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'dirgest-api-'));
  await writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-project', dependencies: { express: '^4' } }));
  await writeFile(path.join(tempDir, 'index.js'), 'export default {};');
});

test.afterEach(async () => {
  app = null;
  await import('node:fs').then((fs) => fs.promises.rm(tempDir, { recursive: true, force: true }));
});

async function req(method, path, body, headers = {}) {
  const init = { method, headers: { 'content-type': 'application/json', ...headers } };
  if (body) init.body = JSON.stringify(body);
  return app.request(path, init);
}

// --- Health ---

test('GET /healthz returns ok', async () => {
  const res = await req('GET', '/healthz');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.version, 'v1');
});

// --- Response envelope ---

test('success responses include ok, data, and meta', async () => {
  const res = await req('POST', '/api/v1/projects/inspect/upload', { files: [{ path: 'a.js', content: 'export default {};' }], name: 'tiny' });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.data);
  assert.ok(body.meta);
  assert.equal(body.meta.version, 'v1');
  assert.ok(body.meta.timestamp);
});

test('error responses include ok, error, and meta', async () => {
  const res = await req('POST', '/api/v1/projects/inspect/upload', {});
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.ok(body.error);
  assert.equal(body.error.code, 'bad-request');
});

// --- Upload inspection ---

test('POST /projects/inspect/upload builds context from files', async () => {
  const files = [
    { path: 'package.json', content: JSON.stringify({ name: 'my-app', dependencies: { react: '^18' } }) },
    { path: 'index.js', content: 'export default {};' },
  ];
  const res = await req('POST', '/api/v1/projects/inspect/upload', { files, name: 'my-app' });
  assert.equal(res.status, 201);
  const { data } = await res.json();
  assert.ok(data.id);
  assert.equal(data.context.name, 'my-app');
  assert.ok(data.context.summary);
});

test('POST /projects/inspect/upload rejects empty files array', async () => {
  const res = await req('POST', '/api/v1/projects/inspect/upload', { files: [] });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.message.includes('at least one'));
});

test('POST /projects/inspect/upload rejects files without path', async () => {
  const res = await req('POST', '/api/v1/projects/inspect/upload', { files: [{ content: 'hi' }] });
  assert.equal(res.status, 400);
});

test('POST /projects/inspect/upload returns cached context for same files', async () => {
  const files = [{ path: 'x.js', content: 'export {};' }];
  const res1 = await req('POST', '/api/v1/projects/inspect/upload', { files, name: 'x' });
  const res2 = await req('POST', '/api/v1/projects/inspect/upload', { files, name: 'x' });
  const body1 = await res1.json();
  const body2 = await res2.json();
  assert.equal(body1.data.id, body2.data.id);
  assert.equal(res2.status, 200);
});

// --- Local directory inspection ---

test('POST /projects/inspect scans a local directory', async () => {
  const res = await req('POST', '/api/v1/projects/inspect', { directory: tempDir });
  assert.equal(res.status, 201);
  const { data } = await res.json();
  assert.ok(data.id);
  assert.equal(data.context.name, 'test-project');
});

test('POST /projects/inspect rejects missing directory', async () => {
  const res = await req('POST', '/api/v1/projects/inspect', {});
  assert.equal(res.status, 400);
});

test('POST /projects/inspect returns 404 for nonexistent directory', async () => {
  const res = await req('POST', '/api/v1/projects/inspect', { directory: '/nonexistent/path' });
  assert.equal(res.status, 404);
});

// --- GET project ---

test('GET /projects/:id returns cached context', async () => {
  const insp = await req('POST', '/api/v1/projects/inspect/upload', { files: [{ path: 'a.js', content: '{}' }], name: 'a' });
  const { data: { id } } = await insp.json();
  const res = await req('GET', `/api/v1/projects/${id}`);
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.equal(data.id, id);
  assert.ok(data.context);
});

test('GET /projects/:id returns 404 for unknown id', async () => {
  const res = await req('GET', '/api/v1/projects/unknown');
  assert.equal(res.status, 404);
});

// --- Suggestions ---

test('POST /projects/:id/suggestions generates mock suggestions', async () => {
  const insp = await req('POST', '/api/v1/projects/inspect/upload', { files: [{ path: 'a.js', content: '{}' }], name: 'a' });
  const { data: { id } } = await insp.json();
  const res = await req('POST', `/api/v1/projects/${id}/suggestions`, { mode: 'ux', mock: true });
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.equal(data.mode, 'ux');
  assert.ok(Array.isArray(data.suggestions));
  assert.ok(data.suggestions.length >= 4);
  assert.ok(data.suggestions[0].title);
  assert.ok(data.suggestions[0].prompt);
});

test('POST /projects/:id/suggestions rejects invalid mode', async () => {
  const insp = await req('POST', '/api/v1/projects/inspect/upload', { files: [{ path: 'a.js', content: '{}' }], name: 'a' });
  const { data: { id } } = await insp.json();
  const res = await req('POST', `/api/v1/projects/${id}/suggestions`, { mode: 'invalid' });
  assert.equal(res.status, 400);
});

test('POST /projects/:id/suggestions returns 404 for unknown project', async () => {
  const res = await req('POST', '/api/v1/projects/fake/suggestions', { mock: true });
  assert.equal(res.status, 404);
});

// --- Ask ---

test('POST /projects/:id/ask evaluates a feature idea', async () => {
  const insp = await req('POST', '/api/v1/projects/inspect/upload', { files: [{ path: 'a.js', content: '{}' }], name: 'a' });
  const { data: { id } } = await insp.json();
  const res = await req('POST', `/api/v1/projects/${id}/ask`, { question: 'add dark mode toggle', mock: true });
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.equal(typeof data.response.fit, 'boolean');
  assert.ok(data.response.reasoning);
});

test('POST /projects/:id/ask rejects missing question', async () => {
  const insp = await req('POST', '/api/v1/projects/inspect/upload', { files: [{ path: 'a.js', content: '{}' }], name: 'a' });
  const { data: { id } } = await insp.json();
  const res = await req('POST', `/api/v1/projects/${id}/ask`, {});
  assert.equal(res.status, 400);
});

// --- History ---

test('GET /projects/:id/history returns history array', async () => {
  const insp = await req('POST', '/api/v1/projects/inspect/upload', { files: [{ path: 'a.js', content: '{}' }], name: 'a' });
  const { data: { id } } = await insp.json();
  const res = await req('GET', `/api/v1/projects/${id}/history`);
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.ok(Array.isArray(data.history));
});

test('POST /projects/:id/history records a selection', async () => {
  const insp = await req('POST', '/api/v1/projects/inspect/upload', { files: [{ path: 'a.js', content: '{}' }], name: 'a' });
  const { data: { id } } = await insp.json();
  const res = await req('POST', `/api/v1/projects/${id}/history`, { mode: 'balanced', title: 'Test Feature' });
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.equal(data.recorded, true);
});

test('DELETE /projects/:id/history clears history', async () => {
  const insp = await req('POST', '/api/v1/projects/inspect/upload', { files: [{ path: 'a.js', content: '{}' }], name: 'a' });
  const { data: { id } } = await insp.json();
  await req('POST', `/api/v1/projects/${id}/history`, { mode: 'balanced', title: 'Gone' });
  const res = await req('DELETE', `/api/v1/projects/${id}/history`);
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.equal(data.cleared, true);
});

// --- Auth ---

test('auth middleware rejects missing key when keys are configured', async () => {
  ({ app } = createApp({ validApiKeys: ['secret-key'] }));
  const res = await req('GET', '/api/v1/projects/unknown');
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error.code, 'unauthorized');
});

test('auth middleware rejects invalid key', async () => {
  ({ app } = createApp({ validApiKeys: ['secret-key'] }));
  const res = await req('GET', '/api/v1/projects/unknown', null, { 'x-api-key': 'wrong' });
  assert.equal(res.status, 403);
});

test('auth middleware accepts valid key', async () => {
  ({ app } = createApp({ validApiKeys: ['secret-key'] }));
  const res = await req('GET', '/api/v1/projects/unknown', null, { 'x-api-key': 'secret-key' });
  assert.equal(res.status, 404);
});

test('auth middleware passes through when no keys configured', async () => {
  ({ app } = createApp({ validApiKeys: [] }));
  const res = await req('GET', '/api/v1/projects/unknown');
  assert.equal(res.status, 404);
});

// --- 404 ---

test('unknown route returns 404 with envelope', async () => {
  const res = await req('GET', '/nope');
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'not-found');
});

// --- Async jobs ---

test('POST /projects/:id/inspect/async creates a job and GET /jobs/:id polls it', async () => {
  const res1 = await req('POST', '/api/v1/projects/fake/inspect/async', { directory: tempDir });
  assert.equal(res1.status, 202);
  const { data: job } = await res1.json();
  assert.ok(job.id);
  assert.equal(job.status, 'pending');

  await new Promise((r) => setTimeout(r, 100));

  const res2 = await req('GET', `/api/v1/jobs/${job.id}`);
  assert.equal(res2.status, 200);
  const { data: result } = await res2.json();
  assert.ok(result.status === 'completed' || result.status === 'pending');
});

test('GET /jobs/:unknown returns 404', async () => {
  const res = await req('GET', '/api/v1/jobs/nonexistent');
  assert.equal(res.status, 404);
});
