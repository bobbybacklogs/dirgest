import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectProject, buildProjectContext, filePriority, sortByPriority, detectLanguage, detectFramework, findEntryPoints, summarizeDependencies, detectProjectType, detectProjectSummary } from '@dirgest/sdk/lib/scanner.js';

test('inspectProject derives metadata and excludes sensitive or ignored files', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dirgest-'));
  await mkdir(path.join(directory, 'node_modules'));
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: 'sample-app', scripts: { test: 'node --test' } }));
  await writeFile(path.join(directory, 'README.md'), '# Sample App\nUseful context');
  await writeFile(path.join(directory, 'index.js'), 'export const active = true;');
  await writeFile(path.join(directory, '.env'), 'TOP_SECRET=never-send');
  await writeFile(path.join(directory, 'node_modules', 'hidden.js'), 'never-send');
  const project = await inspectProject(directory);
  assert.equal(project.name, 'sample-app');
  assert.deepEqual(project.metadata.scripts, ['test']);
  assert.match(project.sample, /index\.js/);
  assert.doesNotMatch(project.sample, /TOP_SECRET|never-send/);
});

test('inspectProject includes a project summary when metadata is present', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dirgest-'));
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: 'my-app', dependencies: { react: '^18', next: '^14' } }));
  await writeFile(path.join(directory, 'index.js'), 'export default {};');
  await writeFile(path.join(directory, 'app.tsx'), 'export default function App() {}');
  const project = await inspectProject(directory);
  assert.ok(project.summary, 'summary should be present');
  assert.ok(project.summary.includes('Next.js'), 'should detect Next.js framework');
  assert.ok(project.summary.includes('TypeScript'), 'should detect TypeScript');
});

test('inspectProject returns null summary for bare directory', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dirgest-'));
  const project = await inspectProject(directory);
  assert.equal(project.summary, null);
});

test('inspectProject crawl builds a full project layout and samples nested directories', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dirgest-'));
  await mkdir(path.join(directory, 'apps', 'web', 'src'), { recursive: true });
  await mkdir(path.join(directory, 'services', 'api', 'routes'), { recursive: true });
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: 'workspace', workspaces: ['apps/*', 'services/*'] }));
  await writeFile(path.join(directory, 'apps', 'web', 'src', 'app.tsx'), 'export default function App() { return null; }');
  await writeFile(path.join(directory, 'services', 'api', 'routes', 'health.js'), 'export const health = () => ({ ok: true });');

  const project = await inspectProject(directory, { crawl: true });

  assert.equal(project.crawl, true);
  assert.equal(project.metadata.discoveredFileCount, 3);
  assert.match(project.tree, /apps[\\/]web[\\/]src[\\/]app\.tsx/);
  assert.match(project.tree, /services[\\/]api[\\/]routes[\\/]health\.js/);
  assert.ok(project.files.some((file) => file.path.endsWith(path.join('apps', 'web', 'src', 'app.tsx'))));
  assert.ok(project.files.some((file) => file.path.endsWith(path.join('services', 'api', 'routes', 'health.js'))));
});

test('filePriority ranks entry points highest', () => {
  assert.equal(filePriority('index.js'), 0);
  assert.equal(filePriority('main.ts'), 0);
  assert.equal(filePriority('app.jsx'), 0);
  assert.equal(filePriority('server.py'), 0);
});

test('filePriority ranks config and README second', () => {
  assert.equal(filePriority('package.json'), 1);
  assert.equal(filePriority('tsconfig.json'), 1);
  assert.equal(filePriority('README.md'), 1);
  assert.equal(filePriority('vite.config.ts'), 1);
});

test('filePriority ranks schema and model files third', () => {
  assert.equal(filePriority('schema.js'), 2);
  assert.equal(filePriority('model.ts'), 2);
  assert.equal(filePriority('migration.sql'), 2);
});

test('filePriority ranks route and handler files fourth', () => {
  assert.equal(filePriority('routes/api.js'), 3);
  assert.equal(filePriority('handlers/user.ts'), 3);
  assert.equal(filePriority('controllers/auth.js'), 3);
});

test('filePriority ranks test files last', () => {
  assert.equal(filePriority('utils.test.js'), 6);
  assert.equal(filePriority('app.spec.ts'), 6);
  assert.equal(filePriority('flow.e2e.js'), 6);
});

test('sortByPriority puts entry points before utils before tests', () => {
  const files = [
    { path: 'utils/helper.js', content: '' },
    { path: 'index.js', content: '' },
    { path: 'app.test.js', content: '' },
    { path: 'package.json', content: '' },
    { path: 'lib/core.ts', content: '' },
  ];
  const sorted = sortByPriority(files);
  assert.equal(sorted[0].path, 'index.js');
  assert.equal(sorted[1].path, 'package.json');
  assert.ok(sorted.indexOf(sorted.find((f) => f.path === 'app.test.js')) > sorted.indexOf(sorted.find((f) => f.path === 'lib/core.ts')));
});

test('detectLanguage identifies TypeScript and JavaScript', () => {
  assert.equal(detectLanguage([{ path: 'a.ts' }, { path: 'b.tsx' }, { path: 'c.js' }]), 'TypeScript');
  assert.equal(detectLanguage([{ path: 'a.js' }, { path: 'b.mjs' }, { path: 'c.jsx' }]), 'JavaScript');
  assert.equal(detectLanguage([{ path: 'a.py' }, { path: 'b.py' }]), 'Python');
  assert.equal(detectLanguage([]), null);
});

test('detectFramework identifies Next.js and React from dependencies', () => {
  assert.equal(detectFramework({ dependencies: { next: '^14', react: '^18' } }), 'Next.js');
  assert.equal(detectFramework({ dependencies: { react: '^18' } }), 'React');
  assert.equal(detectFramework({ dependencies: { express: '^4' } }), 'Node.js API');
  assert.equal(detectFramework({ dependencies: {} }), null);
  assert.equal(detectFramework({}), null);
});

test('findEntryPoints returns index and main files', () => {
  const files = [{ path: 'index.js' }, { path: 'lib/util.ts' }, { path: 'main.py' }, { path: 'package.json' }];
  const entries = findEntryPoints(files);
  assert.equal(entries.length, 2);
  assert.ok(entries.includes('index.js'));
  assert.ok(entries.includes('main.py'));
});

test('summarizeDependencies returns null for empty deps', () => {
  assert.equal(summarizeDependencies({}), null);
  assert.equal(summarizeDependencies({ dependencies: {} }), null);
});

test('summarizeDependencies counts runtime and dev deps', () => {
  const result = summarizeDependencies({ dependencies: { react: '^18' }, devDependencies: { vitest: '^1' } });
  assert.ok(result.includes('1 runtime, 1 dev'));
  assert.ok(result.includes('react'));
});

test('summarizeDependencies highlights Firebase and AI deps', () => {
  const result = summarizeDependencies({ dependencies: { 'firebase-functions': '^4', openai: '^4', express: '^4' } });
  assert.ok(result.includes('Firebase'));
  assert.ok(result.includes('AI'));
  assert.ok(result.includes('express'));
});

test('detectProjectType identifies app types from dependencies', () => {
  assert.equal(detectProjectType({ dependencies: { next: '^14' } }, []), 'fullstack app');
  assert.equal(detectProjectType({ dependencies: { react: '^18' } }, []), 'frontend app');
  assert.equal(detectProjectType({ dependencies: { express: '^4' } }, []), 'API / backend service');
  assert.equal(detectProjectType({ devDependencies: { typescript: '^5' }, scripts: { build: 'tsc' } }, []), 'library / package');
  assert.equal(detectProjectType({}, []), null);
});

test('detectProjectSummary combines all signals', () => {
  const files = [{ path: 'index.ts' }, { path: 'app.tsx' }];
  const pkg = { dependencies: { next: '^14', react: '^18' }, devDependencies: { typescript: '^5' } };
  const summary = detectProjectSummary(files, pkg);
  assert.ok(summary.includes('fullstack app'));
  assert.ok(summary.includes('Next.js'));
  assert.ok(summary.includes('index.ts'));
  assert.ok(summary.includes('TypeScript'));
});

test('detectProjectSummary returns null for empty input', () => {
  assert.equal(detectProjectSummary([], {}), null);
  assert.equal(detectProjectSummary([], undefined), null);
});

test('buildProjectContext constructs a full context from pre-loaded files', () => {
  const files = [
    { path: 'package.json', content: JSON.stringify({ name: 'my-api', dependencies: { express: '^4' }, devDependencies: { vitest: '^1' } }) },
    { path: 'index.js', content: 'import express from "express"; export default express();' },
    { path: 'lib/routes.js', content: 'export const routes = [];' },
    { path: 'lib/routes.test.js', content: 'import { test } from "vitest"; test("routes", () => {});' },
  ];
  const pkg = JSON.parse(files[0].content);
  const context = buildProjectContext('/tmp/my-api', files, pkg);
  assert.equal(context.name, 'my-api');
  assert.ok(context.directory.endsWith(path.join('tmp', 'my-api')) || context.directory.endsWith('my-api'));
  assert.ok(context.summary.includes('API / backend service'));
  assert.ok(context.summary.includes('Node.js API'));
  assert.equal(context.detectedProjectType, 'API / backend service');
  assert.equal(context.detectedFramework, 'Node.js API');
  assert.ok(context.entryPoints.includes('index.js'));
  assert.equal(context.files.length, 4);
  assert.equal(context.files[0].path, 'index.js');
  assert.ok(typeof context.files[0].priority === 'number');
  assert.ok(context.sample.includes('index.js'));
  assert.deepEqual(context.dependencies.runtime, ['express']);
  assert.deepEqual(context.dependencies.dev, ['vitest']);
  assert.deepEqual(context.dependencies.firebase, []);
  assert.equal(context.metadata.packageName, 'my-api');
  assert.deepEqual(context.metadata.scripts, []);
});

test('buildProjectContext works with empty files', () => {
  const context = buildProjectContext('/tmp/empty', [], undefined);
  assert.equal(context.name, 'empty');
  assert.equal(context.summary, null);
  assert.equal(context.files.length, 0);
  assert.equal(context.sample, '');
  assert.deepEqual(context.entryPoints, []);
  assert.equal(context.detectedLanguage, null);
  assert.equal(context.detectedFramework, null);
  assert.equal(context.detectedProjectType, null);
});

test('buildProjectContext detects Firebase dependencies', () => {
  const files = [
    { path: 'package.json', content: JSON.stringify({ dependencies: { 'firebase-functions': '^4', firebase: '^10' } }) },
    { path: 'index.js', content: 'export default {};' },
  ];
  const pkg = JSON.parse(files[0].content);
  const context = buildProjectContext('/tmp/fb', files, pkg);
  assert.deepEqual(context.dependencies.firebase, ['firebase-functions', 'firebase']);
  assert.ok(context.summary.includes('Firebase'));
});
