export function parseSelection(value, count) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'q') return 'quit';
  if (normalized === 'a') return 'all';
  const tokens = normalized.split(/[\s,]+/).filter(Boolean);
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

export function selectedSuggestionEntries(choice, suggestions) {
  if (choice === 'all') return suggestions.map((suggestion, index) => ({ suggestion, index }));
  if (!Array.isArray(choice)) return [];
  return choice
    .filter((index) => Number.isInteger(index) && index >= 0 && index < suggestions.length)
    .map((index) => ({ suggestion: suggestions[index], index }));
}
