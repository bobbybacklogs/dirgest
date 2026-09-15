import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { promptForSelection } from '../lib/selection.js';
import { renderPrompts, renderSuggestions } from '../lib/ui.js';

test('promptForSelection exits cleanly for non-interactive input', async () => {
  let output = '';
  const stream = new Writable({ write(chunk, encoding, callback) { output += chunk; callback(); } });
  assert.equal(await promptForSelection(process.stdin, stream, { interactive: false, count: 4 }), 'quit');
  assert.match(output, /interactive terminal/);
  assert.match(output, /1-4/);
});

test('renderSuggestions numbers every suggestion from 1 through the real count', () => {
  const suggestions = Array.from({ length: 6 }, (_, index) => ({ title: `Title Item ${index + 1}`, prompt: 'A complete implementation prompt.' }));
  const six = renderSuggestions(suggestions);
  assert.match(six, /1/);
  assert.match(six, /6/);
  assert.match(six, /Choose 1-6/);
  const five = renderSuggestions(suggestions.slice(0, 5));
  assert.match(five, /Choose 1-5/);
  assert.doesNotMatch(five, /Choose 1-6/);
});

test('renderPrompts retains the original suggestion number for one selected prompt', () => {
  const output = renderPrompts([{ title: 'Smart Model Rotation', prompt: 'A complete implementation prompt.' }], 4);
  assert.match(output, /5\. Smart Model Rotation/);
});

test('renderPrompts keeps original numbers for a multi-select', () => {
  const output = renderPrompts(
    [{ title: 'First Chosen Idea', prompt: 'A complete implementation prompt.' }, { title: 'Fifth Chosen Idea', prompt: 'Another complete implementation prompt.' }],
    [0, 4]
  );
  assert.match(output, /1\. First Chosen Idea/);
  assert.match(output, /5\. Fifth Chosen Idea/);
});
