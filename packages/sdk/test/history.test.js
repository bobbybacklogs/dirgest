import assert from 'node:assert/strict';
import test from 'node:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readHistory, writeHistory, clearHistory, formatHistoryForPrompt, historyPath } from '@dirgest/sdk/lib/history.js';

let tempDir;

test.beforeEach(async () => { tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dirgest-test-')); });
test.afterEach(async () => { await fs.rm(tempDir, { recursive: true, force: true }); });

test('readHistory returns empty array when no history exists', async () => {
  const history = await readHistory(tempDir);
  assert.deepEqual(history, []);
});

test('readHistory returns empty array for corrupt history file', async () => {
  const dir = path.join(tempDir, '.dirgest');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'history.json'), 'not json');
  const history = await readHistory(tempDir);
  assert.deepEqual(history, []);
});

test('writeHistory creates history file and reads back entries', async () => {
  await writeHistory(tempDir, { mode: 'balanced', title: 'Test Feature' });
  const history = await readHistory(tempDir);
  assert.equal(history.length, 1);
  assert.equal(history[0].mode, 'balanced');
  assert.equal(history[0].title, 'Test Feature');
  assert.ok(typeof history[0].timestamp === 'number');
});

test('writeHistory appends multiple entries', async () => {
  await writeHistory(tempDir, { mode: 'balanced', title: 'First' });
  await writeHistory(tempDir, { mode: 'ux', title: 'Second' });
  const history = await readHistory(tempDir);
  assert.equal(history.length, 2);
  assert.equal(history[0].title, 'First');
  assert.equal(history[1].title, 'Second');
});

test('writeHistory trims to max 50 entries', async () => {
  for (let i = 0; i < 55; i += 1) {
    await writeHistory(tempDir, { mode: 'balanced', title: `Feature ${i}` });
  }
  const history = await readHistory(tempDir);
  assert.equal(history.length, 50);
  assert.equal(history[0].title, 'Feature 5');
  assert.equal(history[49].title, 'Feature 54');
});

test('clearHistory removes the history directory', async () => {
  await writeHistory(tempDir, { mode: 'balanced', title: 'Gone' });
  await clearHistory(tempDir);
  const history = await readHistory(tempDir);
  assert.deepEqual(history, []);
});

test('clearHistory is safe to call when no history exists', async () => {
  await clearHistory(tempDir);
  const history = await readHistory(tempDir);
  assert.deepEqual(history, []);
});

test('formatHistoryForPrompt returns empty string for empty history', () => {
  assert.equal(formatHistoryForPrompt([]), '');
});

test('formatHistoryForPrompt formats recent entries with date and mode', () => {
  const history = [
    { timestamp: new Date('2025-01-15T10:00:00Z').getTime(), mode: 'balanced', title: 'Project Health' },
    { timestamp: new Date('2025-01-16T10:00:00Z').getTime(), mode: 'ux', title: 'Faster Workflows' },
  ];
  const result = formatHistoryForPrompt(history);
  assert.ok(result.includes('Previously selected suggestions'));
  assert.ok(result.includes('[2025-01-15]'));
  assert.ok(result.includes('[2025-01-16]'));
  assert.ok(result.includes('(balanced) Project Health'));
  assert.ok(result.includes('(ux) Faster Workflows'));
});

test('formatHistoryForPrompt only includes last 10 entries', () => {
  const history = Array.from({ length: 15 }, (_, i) => ({
    timestamp: new Date(`2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`).getTime(),
    mode: 'balanced',
    title: `Feature ${i}`,
  }));
  const result = formatHistoryForPrompt(history);
  assert.ok(!result.includes('Feature 0'));
  assert.ok(result.includes('Feature 5'));
  assert.ok(result.includes('Feature 14'));
});

test('historyPath returns correct path', () => {
  const result = historyPath('/some/dir');
  assert.ok(result.includes('.dirgest') && result.includes('history.json'));
});
