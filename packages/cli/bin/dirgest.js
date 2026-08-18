#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { inspectProject, getAskResponse, getSuggestions, readHistory, writeHistory, clearHistory } from '@dirgest/sdk';
import { promptForSelection } from '../lib/selection.js';
import { browseSuggestions, renderAskResponse, renderError, renderHeader, renderHistory, renderPrompts, renderSuggestions } from '../lib/ui.js';

const [nodeMajor = 0, nodeMinor = 0] = process.versions.node.split('.').map(Number);
const canUseOpenTui = nodeMajor > 26 || (nodeMajor === 26 && nodeMinor >= 4);
const runsSuggestionCommand = process.argv.slice(2).some((argument) => argument === '-s' || argument === '--suggest' || argument === '--suggestions');

// OpenTUI's native renderer needs Node's experimental FFI flag. Re-exec only when it is supported.
if (canUseOpenTui && runsSuggestionCommand && !process.execArgv.includes('--experimental-ffi')) {
  const result = spawnSync(process.execPath, ['--experimental-ffi', ...process.execArgv, process.argv[1], ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

const help = `dirgest - context-aware project feature suggestions

Usage:
  dirgest --suggestions [--dir <directory>] [--crawl] [--mock]
  dirgest --suggest [growth|ux|technical|wild] [--dir <directory>] [--crawl] [--mock]
  dirgest --ask <question> [--dir <directory>] [--crawl] [--mock]
  dirgest --history [--dir <directory>]
  dirgest --clear-history [--dir <directory>]

Options:
  -d, --dir <directory>  Directory to inspect (defaults to current directory)
    -s, --suggest [mode]   Generate balanced suggestions, or target growth, ux, technical, or wild ideas
      --suggestions      Generate balanced feature suggestions (legacy alias)
  -a, --ask <question>    Evaluate a feature idea against the codebase
       --history          Show previously selected suggestions
       --clear-history    Clear suggestion history
       --crawl            Build a broader cross-directory project context
       --mock             Run deterministic offline suggestions
  -h, --help             Show this help message
`;

function parseArguments(argumentsList) {
  const options = { directory: process.cwd(), mock: false, crawl: false, suggest: false, suggestionMode: 'balanced', help: false, ask: false, askQuestion: '', history: false, clearHistory: false };
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
    } else if (argument === '-a' || argument === '--ask') {
      options.ask = true;
      const question = argumentsList[index + 1];
      if (!question || question.startsWith('-')) throw new Error(`${argument} requires a feature question.`);
      options.askQuestion = question;
      index += 1;
    } else if (argument === '--mock') {
      options.mock = true;
    } else if (argument === '--crawl') {
      options.crawl = true;
    } else if (argument === '--history') {
      options.history = true;
    } else if (argument === '--clear-history') {
      options.clearHistory = true;
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
  if (options.clearHistory) {
    await clearHistory(options.directory);
    process.stdout.write(`${renderHeader({ name: 'dirgest', directory: options.directory })}\n\nHistory cleared.\n`);
    return;
  }
  if (options.history) {
    const history = await readHistory(options.directory);
    process.stdout.write(`${renderHeader({ name: 'dirgest', directory: options.directory })}\n${renderHistory(history)}\n`);
    return;
  }
  if (!options.suggest && !options.ask) {
    process.stderr.write(`${renderError('Choose --suggestions, --suggest, --ask, --history, or --clear-history.')}\n\n${help}`);
    process.exitCode = 2;
    return;
  }

  try {
    const project = await inspectProject(options.directory, { crawl: options.crawl });
    process.stdout.write(`${renderHeader(project)}\n`);
    if (options.ask) {
      const response = await getAskResponse(project, options.askQuestion, { mock: options.mock });
      process.stdout.write(`${renderAskResponse(response, options.askQuestion)}\n`);
    } else {
      const suggestions = await getSuggestions(project, { mock: options.mock, mode: options.suggestionMode });
      process.stdout.write(`${renderSuggestions(suggestions)}\n`);
      let choice;
      if (process.stdin.isTTY && process.stdout.isTTY) {
        try {
          choice = await browseSuggestions(suggestions, project);
        } catch (error) {
          const message = error.message?.includes('native FFI is not available')
            ? `OpenTUI requires Node 26.4+; current runtime is ${process.version}. Using the basic terminal picker instead.`
            : 'OpenTUI could not start; using the basic terminal picker instead.';
          process.stderr.write(`${renderError(message)}\n`);
          choice = await promptForSelection(process.stdin, process.stdout, { interactive: true, count: suggestions.length });
        }
      } else {
        choice = await promptForSelection(process.stdin, process.stdout, { interactive: false, count: suggestions.length });
      }
      if (choice === 'all') process.stdout.write(`\n${renderPrompts(suggestions)}\n`);
      if (typeof choice === 'number') {
        process.stdout.write(`\n${renderPrompts([suggestions[choice]])}\n`);
        await writeHistory(project.directory, { mode: options.suggestionMode, title: suggestions[choice].title });
      }
    }
  } catch (error) {
    process.stderr.write(`${renderError(error.message)}\n`);
    process.exitCode = 1;
  }
}

main();
