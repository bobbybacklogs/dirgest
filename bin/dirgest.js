#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { inspectProject } from '../lib/scanner.js';
import { getSuggestions } from '../lib/suggestions.js';
import { promptForSelection } from '../lib/selection.js';
import { renderError, renderHeader, renderPrompts, renderSuggestions } from '../lib/ui.js';

const help = `dirgest - context-aware project feature suggestions

Usage:
  dirgest --suggestions [--dir <directory>] [--mock]
  dirgest --suggest [growth|ux|technical|wild] [--dir <directory>] [--mock]

Options:
  -d, --dir <directory>  Directory to inspect (defaults to current directory)
    -s, --suggest [mode]   Generate balanced suggestions, or target growth, ux, technical, or wild ideas
      --suggestions      Generate balanced feature suggestions (legacy alias)
      --mock             Run deterministic offline suggestions
  -h, --help             Show this help message
`;

function parseArguments(argumentsList) {
  const options = { directory: process.cwd(), mock: false, suggest: false, suggestionMode: 'balanced', help: false };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '-d' || argument === '--dir') {
      const directory = argumentsList[index + 1];
      if (!directory || directory.startsWith('-')) throw new Error(`${argument} requires a directory.`);
      options.directory = path.resolve(directory);
      index += 1;
    } else if (argument === '-s' || argument === '--suggest') {
      options.suggest = true;
      const mode = argumentsList[index + 1];
      if (mode && !mode.startsWith('-')) {
        if (!['growth', 'ux', 'technical', 'wild'].includes(mode)) throw new Error(`Unknown suggestion mode: ${mode}. Choose growth, ux, technical, or wild.`);
        options.suggestionMode = mode;
        index += 1;
      }
    } else if (argument === '--suggestions') {
      options.suggest = true;
    } else if (argument === '--mock') {
      options.mock = true;
    } else if (argument === '-h' || argument === '--help') {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  return options;
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${renderError(error.message)}\n\n${help}`);
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    process.stdout.write(help);
    return;
  }
  if (!options.suggest) {
    process.stderr.write(`${renderError('Choose --suggestions or --suggest.')}\n\n${help}`);
    process.exitCode = 2;
    return;
  }

  try {
    const project = await inspectProject(options.directory);
    process.stdout.write(`${renderHeader(project)}\n`);
    const suggestions = await getSuggestions(project, { mock: options.mock, mode: options.suggestionMode });
    process.stdout.write(`${renderSuggestions(suggestions)}\n`);
    const choice = await promptForSelection(process.stdin, process.stdout, { interactive: process.stdin.isTTY, count: suggestions.length });
    if (choice === 'all') process.stdout.write(`\n${renderPrompts(suggestions)}\n`);
    if (typeof choice === 'number') process.stdout.write(`\n${renderPrompts([suggestions[choice]])}\n`);
  } catch (error) {
    process.stderr.write(`${renderError(error.message)}\n`);
    process.exitCode = 1;
  }
}

main();