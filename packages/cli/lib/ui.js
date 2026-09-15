import { selectionInstructions } from './selection.js';

const ANSI = { reset: '\u001b[0m', bold: '\u001b[1m', dim: '\u001b[2m', cyan: '\u001b[36m', green: '\u001b[32m', red: '\u001b[31m' };
const color = (code, text) => `${code}${text}${ANSI.reset}`;

export function renderHeader(project) {
  const context = project.crawl ? 'Feature suggestions based on a broad directory crawl' : 'Feature suggestions based on a bounded local project sample';
  return `\n${color(ANSI.bold + ANSI.cyan, project.name)} ${color(ANSI.dim, '|')} ${color(ANSI.dim, project.directory)}\n${color(ANSI.dim, context)}`;
}
export function renderInspection(project) {
  const files = project.files.map((file) => file.path);
  const configFiles = files.filter((file) => /(^|[\\/])(package\.json|tsconfig\.json|vite\.config\.|webpack\.config\.|rollup\.config\.|next\.config\.|nuxt\.config\.|dockerfile|makefile|cargo\.toml|go\.mod|pyproject\.toml|requirements\.txt|composer\.json|firebase\.json|apphosting\.yaml)([.]|$)/i.test(file));
  const testFiles = files.filter((file) => /[.]((test|spec|e2e)[.])|(^|[\\/])tests?([\\/]|$)/i.test(file));
  const lines = [
    `\n${color(ANSI.bold + ANSI.cyan, project.name)} ${color(ANSI.dim, '|')} ${color(ANSI.dim, project.directory)}`,
    `\n${color(ANSI.bold, 'Tech stack')}`,
    `  Type: ${project.detectedProjectType || 'Not detected'}`,
    `  Language: ${project.detectedLanguage || 'Not detected'}`,
    `  Framework: ${project.detectedFramework || 'Not detected'}`,
    `\n${color(ANSI.bold, 'Project signals')}`,
    `  Files scanned: ${project.metadata.fileCount}${project.crawl ? ` of ${project.metadata.discoveredFileCount} discovered` : ''}`,
    `  Entry points: ${project.entryPoints.length ? project.entryPoints.join(', ') : 'None detected'}`,
    `  Config files: ${configFiles.length ? configFiles.join(', ') : 'None detected'}`,
    `  Tests: ${testFiles.length ? `${testFiles.length} test file${testFiles.length === 1 ? '' : 's'} found` : 'No test files detected'}`,
  ];

  if (project.metadata.packageName || project.metadata.description) {
    lines.push(`\n${color(ANSI.bold, 'Package metadata')}`);
    if (project.metadata.packageName) lines.push(`  Name: ${project.metadata.packageName}`);
    if (project.metadata.description) lines.push(`  Description: ${project.metadata.description}`);
  }
  if (project.metadata.scripts.length) lines.push(`  Scripts: ${project.metadata.scripts.join(', ')}`);
  if (project.dependencies.runtime.length || project.dependencies.dev.length) {
    lines.push(`\n${color(ANSI.bold, 'Dependencies')}`);
    if (project.dependencies.runtime.length) lines.push(`  Runtime: ${project.dependencies.runtime.join(', ')}`);
    if (project.dependencies.dev.length) lines.push(`  Development: ${project.dependencies.dev.join(', ')}`);
    if (project.dependencies.firebase.length) lines.push(`  Firebase: ${project.dependencies.firebase.join(', ')}`);
    if (project.dependencies.aws.length) lines.push(`  AWS: ${project.dependencies.aws.join(', ')}`);
    if (project.dependencies.ai.length) lines.push(`  AI: ${project.dependencies.ai.join(', ')}`);
  }

  return lines.join('\n');
}
export function renderSuggestions(suggestions) {
  const count = suggestions.length;
  return `\n${suggestions.map((suggestion, index) => `  ${color(ANSI.green, String(index + 1).padStart(2, ' '))}  ${color(ANSI.bold, suggestion.title)}`).join('\n')}\n\n${color(ANSI.dim, selectionInstructions(count))}`;
}
export function renderPrompts(suggestions, startIndex = 0) {
  return suggestions.map((suggestion, index) => {
    const displayNumber = Array.isArray(startIndex) ? startIndex[index] + 1 : startIndex + index + 1;
    return `${color(ANSI.bold + ANSI.cyan, `${displayNumber}. ${suggestion.title}`)}\n${suggestion.prompt}`;
  }).join('\n\n');
}
export function renderError(message) { return color(ANSI.red, `dirgest: ${message}`); }

export function renderAskResponse(response, question) {
  const header = `\n${color(ANSI.dim, 'Feature suggestion for:')} ${color(ANSI.bold, question)}`;
  if (response.fit) {
    return `${header}\n\n${color(ANSI.green, '✓ Good fit')}\n\n${color(ANSI.bold + ANSI.cyan, '1. ' + question.trim())}\n${response.prompt}`;
  }
  return `${header}\n\n${color(ANSI.dim, '✗ Not a great fit for this codebase')}\n\n${response.reasoning}\n\n${color(ANSI.bold, 'Try this instead:')}\n${response.alternative}`;
}

export function renderFeatureReview(review) {
  const source = review.source ? ` ${color(ANSI.bold, review.source)}` : '';
  const header = `\n${color(ANSI.dim, 'Feature review:')}${source}\n${color(ANSI.dim, `${review.total} reviewed  ${review.fitCount} good fit  ${review.misfitCount} not a fit`)}`;
  const sections = [header];

  if (review.misfits.length) {
    const entries = review.misfits.map((misfit, index) => `  ${color(ANSI.red, String(index + 1).padStart(2, ' '))}  ${color(ANSI.bold, misfit.feature)}\n      ${misfit.reasoning}\n      ${color(ANSI.dim, 'Better fit:')} ${misfit.alternative}`);
    sections.push(`${color(ANSI.bold, `✗ Not a fit (${review.misfits.length})`)}\n${entries.join('\n\n')}`);
  }

  if (review.fits.length) {
    const entries = review.fits.map((fit, index) => `${color(ANSI.bold + ANSI.cyan, `${index + 1}. ${fit.title}`)}\n${color(ANSI.dim, fit.feature)}\n${fit.prompt}`);
    sections.push(`${color(ANSI.green, `✓ Good fits (${review.fits.length})`)}\n\n${entries.join('\n\n')}`);
  }

  return sections.join('\n\n');
}

export function renderHistory(history) {
  if (!history.length) return `\n${color(ANSI.dim, 'No suggestion history yet.')}`;
  const lines = history.map((entry) => {
    const date = new Date(entry.timestamp).toISOString().slice(0, 10);
    return `  ${color(ANSI.dim, date)}  ${color(ANSI.green, (entry.mode || 'balanced').padEnd(10))} ${color(ANSI.bold, entry.title)}`;
  });
  return `\n${color(ANSI.bold, 'Suggestion history:')}\n${lines.join('\n')}`;
}

function truncatePreview(prompt, maximumCharacters) {
  if (prompt.length <= maximumCharacters) return prompt;
  return `${prompt.slice(0, Math.max(0, maximumCharacters - 3)).trimEnd()}...`;
}

export async function browseSuggestions(suggestions, project) {
  const { Box, Text, TextAttributes, createCliRenderer } = await import('@opentui/core');
  const renderer = await createCliRenderer({ exitOnCtrlC: false, consoleMode: 'disabled', screenMode: 'alternate-screen' });
  let selectedIndex = 0;
  const toggled = new Set();
  let settled = false;
  const count = suggestions.length;
  const digitPattern = new RegExp(`^[1-${Math.min(9, count)}]$`);

  return new Promise((resolve) => {
    const finish = (choice) => {
      if (settled) return;
      settled = true;
      renderer.destroy();
      resolve(choice);
    };
    const commitToggles = () => {
      if (toggled.size > 0) return finish([...toggled].sort((left, right) => left - right));
      return finish([selectedIndex]);
    };
    const render = () => {
      for (const child of renderer.root.getChildren()) renderer.root.remove(child);
      const previewLimit = Math.max(500, renderer.width * Math.max(8, renderer.height - 9));
      const rows = suggestions.map((suggestion, index) => Text({
        content: `${index === selectedIndex ? '>' : ' '}${toggled.has(index) ? '*' : ' '} ${index + 1}. ${suggestion.title}`,
        fg: index === selectedIndex ? '#67E8F9' : toggled.has(index) ? '#67E8F9' : '#D1D5DB',
        attributes: index === selectedIndex || toggled.has(index) ? TextAttributes.BOLD : 0,
      }));
      renderer.root.add(Box(
        { width: '100%', height: '100%', flexDirection: 'column', padding: 1, gap: 1, backgroundColor: '#0F172A' },
        Text({ content: `DIRGEST  /  ${project.name}`, fg: '#F8FAFC', attributes: TextAttributes.BOLD }),
        Text({ content: project.crawl ? 'Broad project crawl context' : 'Bounded project sample', fg: '#94A3B8' }),
        Box(
          { flexDirection: 'row', flexGrow: 1, gap: 1 },
          Box({ width: '38%', borderStyle: 'rounded', borderColor: '#334155', padding: 1, title: `Suggestions (${count})`, titleColor: '#94A3B8', gap: 1 }, ...rows),
          Box(
            { flexGrow: 1, borderStyle: 'rounded', borderColor: '#155E75', padding: 1, title: suggestions[selectedIndex].title, titleColor: '#67E8F9' },
            Text({ content: truncatePreview(suggestions[selectedIndex].prompt, previewLimit), fg: '#E2E8F0' }),
          ),
        ),
        Text({ content: `Up/Down or j/k: browse  Space or 1-${count}: toggle  Enter: select  a: all prompts  q: quit`, fg: '#94A3B8' }),
      ));
    };

    renderer.keyInput.on('keypress', (key) => {
      if (key.ctrl && key.name === 'c') return finish('quit');
      if (key.name === 'q' || key.name === 'escape') return finish('quit');
      if (key.name === 'a') return finish('all');
      if (key.name === 'return') return commitToggles();
      if (key.name === 'space') {
        if (toggled.has(selectedIndex)) toggled.delete(selectedIndex);
        else toggled.add(selectedIndex);
        render();
        return;
      }
      if (key.name === 'up' || key.name === 'k') {
        selectedIndex = (selectedIndex - 1 + suggestions.length) % suggestions.length;
        render();
      }
      if (key.name === 'down' || key.name === 'j') {
        selectedIndex = (selectedIndex + 1) % suggestions.length;
        render();
      }
      if (digitPattern.test(key.name)) {
        const index = Number(key.name) - 1;
        if (index < suggestions.length) {
          if (toggled.has(index)) toggled.delete(index);
          else toggled.add(index);
          selectedIndex = index;
          render();
        }
      }
    });
    renderer.on('resize', render);
    render();
  });
}
