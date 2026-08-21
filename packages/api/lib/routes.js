import { Hono } from 'hono';
import { buildProjectContext, inspectProject, getSuggestions, getAskResponse, parseFeatureList, reviewFeatures, readHistory, clearHistory, writeHistory, FEATURE_FILE_EXTENSIONS, MAX_FEATURE_FILE_BYTES, MAX_FEATURES } from '@dirgest/sdk';

const API_VERSION = 'v1';

function ok(data, status = 200) {
  return Response.json({ ok: true, data, meta: { version: API_VERSION, timestamp: new Date().toISOString() } }, { status });
}

function fail(code, message, status = 400) {
  return Response.json({ ok: false, error: { code, message }, meta: { version: API_VERSION, timestamp: new Date().toISOString() } }, { status });
}

function validateMode(mode) {
  return ['balanced', 'growth', 'ux', 'technical', 'wild'].includes(mode);
}

function extensionOf(filename) {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

export function createRoutes(cache, jobs) {
  const app = new Hono();

  // POST /projects/inspect — scan a local directory
  app.post('/projects/inspect', async (c) => {
    const { directory } = await c.req.json();
    if (!directory || typeof directory !== 'string') return fail('bad-request', 'A "directory" string is required.');
    try {
      const context = await inspectProject(directory);
      const id = cache.createId(context.files);
      cache.set(id, context);
      return ok({ id, context }, 201);
    } catch (error) {
      if (error.message.includes('Not a directory') || error.message.includes('Directory not found')) return fail('not-found', error.message, 404);
      throw error;
    }
  });

  // POST /projects/inspect/upload — build context from uploaded files
  app.post('/projects/inspect/upload', async (c) => {
    const { files, name } = await c.req.json();
    if (!Array.isArray(files) || files.length === 0) return fail('bad-request', 'A "files" array with at least one file is required.');
    for (const file of files) {
      if (!file.path || typeof file.content !== 'string') return fail('bad-request', 'Each file must have a "path" string and "content" string.');
    }
    const id = cache.createId(files);
    if (cache.has(id)) return ok({ id, context: cache.get(id) });
    let packageMetadata;
    const packageFile = files.find((f) => f.path === 'package.json');
    if (packageFile) {
      try { packageMetadata = JSON.parse(packageFile.content); } catch { packageMetadata = undefined; }
    }
    const context = buildProjectContext(name || id, files, packageMetadata);
    cache.set(id, context);
    return ok({ id, context }, 201);
  });

  // GET /projects/:id — retrieve a cached project context
  app.get('/projects/:id', async (c) => {
    const id = c.req.param('id');
    const context = cache.get(id);
    if (!context) return fail('not-found', `Project ${id} not found. Inspect it first.`, 404);
    return ok({ id, context });
  });

  // POST /projects/:id/suggestions — generate suggestions for a project
  app.post('/projects/:id/suggestions', async (c) => {
    const id = c.req.param('id');
    const context = cache.get(id);
    if (!context) return fail('not-found', `Project ${id} not found. Inspect it first.`, 404);
    const { mode = 'balanced', mock = false } = await c.req.json().catch(() => ({}));
    if (!validateMode(mode)) return fail('bad-request', `Invalid mode "${mode}". Choose from: balanced, growth, ux, technical, wild.`);
    const environment = Object.fromEntries(Object.entries(process.env).filter(([, v]) => typeof v === 'string'));
    const suggestions = await getSuggestions(context, { mode, mock, environment });
    return ok({ id, mode, suggestions });
  });

  // POST /projects/:id/ask — evaluate a feature idea
  app.post('/projects/:id/ask', async (c) => {
    const id = c.req.param('id');
    const context = cache.get(id);
    if (!context) return fail('not-found', `Project ${id} not found. Inspect it first.`, 404);
    const { question, mock = false } = await c.req.json();
    if (!question || typeof question !== 'string') return fail('bad-request', 'A "question" string is required.');
    const environment = Object.fromEntries(Object.entries(process.env).filter(([, v]) => typeof v === 'string'));
    const response = await getAskResponse(context, question, { mock, environment });
    return ok({ id, response });
  });

  // POST /projects/:id/review — review a .md/.txt feature list against the project
  app.post('/projects/:id/review', async (c) => {
    const id = c.req.param('id');
    const context = cache.get(id);
    if (!context) return fail('not-found', `Project ${id} not found. Inspect it first.`, 404);
    const { content, filename, features, mock = false } = await c.req.json();
    if (filename && !FEATURE_FILE_EXTENSIONS.includes(extensionOf(filename))) {
      return fail('bad-request', `Feature files must be ${FEATURE_FILE_EXTENSIONS.join(' or ')}; received "${filename}".`);
    }

    let featureList;
    if (Array.isArray(features)) {
      featureList = features.map((feature) => String(feature ?? '').trim()).filter(Boolean);
      if (featureList.length === 0) return fail('bad-request', 'The "features" array must contain at least one feature.');
      if (featureList.length > MAX_FEATURES) return fail('payload-too-large', `Received ${featureList.length} features; the limit is ${MAX_FEATURES}.`, 413);
    } else if (typeof content === 'string') {
      if (Buffer.byteLength(content, 'utf8') > MAX_FEATURE_FILE_BYTES) {
        return fail('payload-too-large', `Feature file content exceeds the ${MAX_FEATURE_FILE_BYTES / 1024} KB limit.`, 413);
      }
      try {
        featureList = parseFeatureList(content, filename || 'feature file');
      } catch (error) {
        return fail('bad-request', error.message);
      }
    } else {
      return fail('bad-request', 'A "content" string or a "features" array is required.');
    }

    const environment = Object.fromEntries(Object.entries(process.env).filter(([, v]) => typeof v === 'string'));
    const review = await reviewFeatures(context, featureList, { mock, environment, source: filename });
    return ok({ id, review });
  });

  // GET /projects/:id/history — read suggestion history
  app.get('/projects/:id/history', async (c) => {
    const id = c.req.param('id');
    const context = cache.get(id);
    if (!context) return fail('not-found', `Project ${id} not found. Inspect it first.`, 404);
    const history = await readHistory(context.directory);
    return ok({ id, history });
  });

  // POST /projects/:id/history — record a selection
  app.post('/projects/:id/history', async (c) => {
    const id = c.req.param('id');
    const context = cache.get(id);
    if (!context) return fail('not-found', `Project ${id} not found. Inspect it first.`, 404);
    const { mode, title } = await c.req.json();
    if (!title || typeof title !== 'string') return fail('bad-request', 'A "title" string is required.');
    await writeHistory(context.directory, { mode: mode || 'balanced', title });
    return ok({ id, recorded: true });
  });

  // DELETE /projects/:id/history — clear suggestion history
  app.delete('/projects/:id/history', async (c) => {
    const id = c.req.param('id');
    const context = cache.get(id);
    if (!context) return fail('not-found', `Project ${id} not found. Inspect it first.`, 404);
    await clearHistory(context.directory);
    return ok({ id, cleared: true });
  });

  // POST /projects/:id/inspect/async — async inspection for large repos
  app.post('/projects/:id/inspect/async', async (c) => {
    const { directory } = await c.req.json();
    if (!directory || typeof directory !== 'string') return fail('bad-request', 'A "directory" string is required.');
    const job = jobs.create(async () => {
      const context = await inspectProject(directory);
      const projectId = cache.createId(context.files);
      cache.set(projectId, context);
      return { id: projectId, context };
    });
    return ok(job, 202);
  });

  // GET /jobs/:id — poll async job status
  app.get('/jobs/:id', async (c) => {
    const jobId = c.req.param('id');
    const job = jobs.get(jobId);
    if (!job) return fail('not-found', `Job ${jobId} not found.`, 404);
    return ok(job);
  });

  return app;
}
