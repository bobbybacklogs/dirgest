const ANSI = { reset: '\u001b[0m', bold: '\u001b[1m', dim: '\u001b[2m', cyan: '\u001b[36m', green: '\u001b[32m', red: '\u001b[31m' };
const color = (code, text) => `${code}${text}${ANSI.reset}`;

export function renderHeader(project) { return `\n${color(ANSI.bold + ANSI.cyan, project.name)} ${color(ANSI.dim, '|')} ${color(ANSI.dim, project.directory)}\n${color(ANSI.dim, 'Feature suggestions based on a bounded local project sample')}`; }
export function renderSuggestions(suggestions) { return `\n${suggestions.map((suggestion, index) => `  ${color(ANSI.green, String(index + 1).padStart(2, ' '))}  ${color(ANSI.bold, suggestion.title)}`).join('\n')}\n\n${color(ANSI.dim, 'Choose 1-6 for a full coding prompt, a for all prompts, q to exit.')}`; }
export function renderPrompts(suggestions) { return suggestions.map((suggestion, index) => `${color(ANSI.bold + ANSI.cyan, `${index + 1}. ${suggestion.title}`)}\n${suggestion.prompt}`).join('\n\n'); }
export function renderError(message) { return color(ANSI.red, `dirgest: ${message}`); }