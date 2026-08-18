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
