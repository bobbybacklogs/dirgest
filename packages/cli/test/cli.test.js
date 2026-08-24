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

test('--inspect reports tech stack and common project signals', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dirgest-cli-inspect-'));
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({
    name: 'inspect-test',
    description: 'A sample API',
    scripts: { test: 'vitest', build: 'tsc' },
    dependencies: { express: '^4', zod: '^3' },
    devDependencies: { typescript: '^5', vitest: '^1' },
  }));
  await writeFile(path.join(directory, 'tsconfig.json'), '{}');
  await writeFile(path.join(directory, 'server.ts'), 'export const app = {};');
  await writeFile(path.join(directory, 'server.test.ts'), 'test("works", () => {});');

  const result = spawnSync(process.execPath, ['bin/dirgest.js', '--inspect', '--dir', directory], {
    cwd: packageDirectory,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Tech stack/);
  assert.match(result.stdout, /TypeScript/);
  assert.match(result.stdout, /Node\.js API/);
  assert.match(result.stdout, /Entry points: server\.ts/);
  assert.match(result.stdout, /Config files: package\.json, tsconfig\.json/);
  assert.match(result.stdout, /Tests: 1 test file found/);
  assert.match(result.stdout, /Scripts: test, build/);
  assert.match(result.stdout, /Runtime: express, zod/);
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
