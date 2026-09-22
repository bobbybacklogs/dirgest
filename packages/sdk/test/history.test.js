import assert from 'node:assert/strict';
import test from 'node:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readHistory, writeHistory, clearHistory, formatHistoryForPrompt, historyPath, titleFromPrompt, askHistoryEntry, excludeHistoryEntry, withoutExcludedSuggestions, savedPromptEntries, formatSavedPrompts } from '@dirgest/sdk/lib/history.js';

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

test('titleFromPrompt strips leading verbs and truncates long sentences', () => {
  assert.equal(titleFromPrompt('Implement a health dashboard for the app.'), 'a health dashboard for the app');
  assert.equal(titleFromPrompt(''), 'Recommended alternative');
  const long = `Implement ${'x'.repeat(120)}.`;
  const title = titleFromPrompt(long);
  assert.ok(title.length <= 80);
  assert.ok(title.endsWith('...'));
});

test('askHistoryEntry records accepted ideas and recommended alternatives', () => {
  const fitPrompt = 'Implement dark mode for the app with tests and existing theme tokens in place here.';
  const fit = askHistoryEntry('add dark mode toggle', { fit: true, prompt: fitPrompt });
  assert.deepEqual(fit, { mode: 'ask', title: 'add dark mode toggle', verdict: 'fit', question: 'add dark mode toggle', prompt: fitPrompt });
  const misfit = askHistoryEntry('hardware dongle', { fit: false, alternative: 'Implement a project health summary dashboard that surfaces recent changes and metrics from the existing codebase.' });
  assert.equal(misfit.mode, 'ask');
  assert.equal(misfit.verdict, 'misfit');
  assert.equal(misfit.rejected, 'hardware dongle');
  assert.ok(misfit.title.startsWith('a project health summary dashboard'));
  assert.ok(misfit.title.length <= 80);
  assert.equal(misfit.prompt, 'Implement a project health summary dashboard that surfaces recent changes and metrics from the existing codebase.');
});

test('writeHistory skips duplicate excluded titles', async () => {
  await writeHistory(tempDir, excludeHistoryEntry('balanced', 'Project Health Summary'));
  await writeHistory(tempDir, excludeHistoryEntry('ux', 'Project Health Summary'));
  const history = await readHistory(tempDir);
  assert.equal(history.length, 1);
  assert.equal(history[0].verdict, 'excluded');
  assert.equal(history[0].mode, 'balanced');
});

test('withoutExcludedSuggestions drops matching titles case-insensitively', () => {
  const suggestions = [
    { title: 'Project Health Summary', prompt: 'x'.repeat(80) },
    { title: 'Guided First Run', prompt: 'x'.repeat(80) },
  ];
  const filtered = withoutExcludedSuggestions(suggestions, [excludeHistoryEntry('balanced', 'project health summary')]);
  assert.deepEqual(filtered.map((suggestion) => suggestion.title), ['Guided First Run']);
});

test('formatHistoryForPrompt lists excluded ideas separately', () => {
  const history = [
    { timestamp: new Date('2025-01-15T10:00:00Z').getTime(), mode: 'balanced', title: 'Project Health' },
    { timestamp: new Date('2025-01-16T10:00:00Z').getTime(), mode: 'ux', title: 'Faster Workflows', verdict: 'excluded' },
  ];
  const result = formatHistoryForPrompt(history);
  assert.ok(result.includes('Previously selected suggestions'));
  assert.ok(result.includes('(balanced) Project Health'));
  assert.ok(result.includes('Previously excluded suggestions'));
  assert.ok(result.includes('(ux) Faster Workflows'));
  assert.ok(result.indexOf('excluded suggestions') < result.lastIndexOf('Faster Workflows'));
});

test('formatHistoryForPrompt describes ask fits and misfits', () => {
  const history = [
    { timestamp: new Date('2025-01-15T10:00:00Z').getTime(), mode: 'ask', verdict: 'fit', title: 'dark mode toggle', question: 'dark mode toggle' },
    { timestamp: new Date('2025-01-16T10:00:00Z').getTime(), mode: 'ask', verdict: 'misfit', title: 'health dashboard', rejected: 'hardware dongle' },
  ];
  const result = formatHistoryForPrompt(history);
  assert.ok(result.includes('Accepted "dark mode toggle"'));
  assert.ok(result.includes('Chose "health dashboard" instead of "hardware dongle"'));
});

test('writeHistory stores the full coding prompt with a selection', async () => {
  const prompt = 'Implement a project health summary dashboard with tests and existing conventions.';
  await writeHistory(tempDir, { mode: 'growth', title: 'Project Health Summary', prompt });
  const history = await readHistory(tempDir);
  assert.equal(history[0].prompt, prompt);
});

test('savedPromptEntries omits exclusions and entries without prompts', () => {
  const prompt = 'Implement a guided first run that walks through setup and validation.';
  const history = [
    { timestamp: 1, mode: 'balanced', title: 'Guided First Run', prompt },
    { timestamp: 2, mode: 'ux', title: 'Faster Workflows', verdict: 'excluded' },
    { timestamp: 3, mode: 'technical', title: 'No Prompt Saved' },
  ];
  const saved = savedPromptEntries(history);
  assert.deepEqual(saved.map((entry) => entry.title), ['Guided First Run']);
  assert.match(formatSavedPrompts(history), /1\. Guided First Run \(balanced\)/);
  assert.match(formatSavedPrompts(history), /guided first run/);
});
