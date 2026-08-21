import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('--crawl builds broad context before generating offline suggestions', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dirgest-cli-'));
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: 'crawl-test' }));
  await writeFile(path.join(directory, 'index.js'), 'export const ready = true;');
  const result = spawnSync(process.execPath, ['bin/dirgest.js', '--suggest', '--crawl', '--mock', '--dir', directory], {
    cwd: packageDirectory,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Feature suggestions based on a broad directory crawl/);
  assert.match(result.stdout, /Project Health Summary/);
});

test('--review ingests a markdown feature list and reports fits and misfits', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dirgest-cli-review-'));
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: 'review-test' }));
  await writeFile(path.join(directory, 'index.js'), 'export const ready = true;');
  const featureFile = path.join(directory, 'features.md');
  await writeFile(featureFile, '# Roadmap\n- Add dark mode toggle\n- A vague aspiration about the future\n');
  const result = spawnSync(process.execPath, ['bin/dirgest.js', '--review', featureFile, '--mock', '--dir', directory], {
    cwd: packageDirectory,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Feature suggestions based on a broad directory crawl/);
  assert.match(result.stdout, /features\.md/);
  assert.match(result.stdout, /2 reviewed {2}1 good fit {2}1 not a fit/);
  assert.match(result.stdout, /Not a fit \(1\)/);
  assert.match(result.stdout, /Good fits \(1\)/);
});

test('--review rejects unsupported feature file types', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dirgest-cli-review-bad-'));
  const featureFile = path.join(directory, 'features.json');
  await writeFile(featureFile, '[]');
  const result = spawnSync(process.execPath, ['bin/dirgest.js', '--review', featureFile, '--mock', '--dir', directory], {
    cwd: packageDirectory,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must be \.txt or \.md/);
});
