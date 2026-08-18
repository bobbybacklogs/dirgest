import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { promptForSelection } from '../lib/selection.js';
import { renderPrompts } from '../lib/ui.js';

test('promptForSelection exits cleanly for non-interactive input', async () => {
  let output = '';
  const stream = new Writable({ write(chunk, encoding, callback) { output += chunk; callback(); } });
  assert.equal(await promptForSelection(process.stdin, stream, { interactive: false, count: 4 }), 'quit');
  assert.match(output, /interactive terminal/);
});

test('renderPrompts retains the original suggestion number for one selected prompt', () => {
  const output = renderPrompts([{ title: 'Smart Model Rotation', prompt: 'A complete implementation prompt.' }], 4);
  assert.match(output, /5\. Smart Model Rotation/);
});
