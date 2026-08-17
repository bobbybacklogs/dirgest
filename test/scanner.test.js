import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectProject } from '../lib/scanner.js';

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