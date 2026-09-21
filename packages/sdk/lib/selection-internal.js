export function isExcludeChoice(choice) {
  return Boolean(choice) && typeof choice === 'object' && !Array.isArray(choice) && Array.isArray(choice.exclude);
}

function parseIndices(body, count) {
  const tokens = String(body || '').split(/[\s,]+/).filter(Boolean);
  const indices = [];
  for (const token of tokens) {
    if (!/^\d+$/.test(token)) return null;
    const selected = Number.parseInt(token, 10);
    if (!Number.isInteger(selected) || selected < 1 || selected > count) return null;
    const index = selected - 1;
    if (!indices.includes(index)) indices.push(index);
  }
  return indices.length > 0 ? indices : null;
}

export function parseSelection(value, count) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'q') return 'quit';
  if (normalized === 'a') return 'all';
  if (normalized.startsWith('x')) {
    const body = normalized.slice(1).replace(/^[:\s]+/, '');
    const indices = parseIndices(body, count);
    return indices ? { exclude: indices } : null;
  }
  return parseIndices(normalized, count);
}

export function selectedSuggestionEntries(choice, suggestions) {
  if (choice === 'all') return suggestions.map((suggestion, index) => ({ suggestion, index }));
  const indices = isExcludeChoice(choice) ? choice.exclude : choice;
  if (!Array.isArray(indices)) return [];
  return indices
    .filter((index) => Number.isInteger(index) && index >= 0 && index < suggestions.length)
    .map((index) => ({ suggestion: suggestions[index], index }));
}
