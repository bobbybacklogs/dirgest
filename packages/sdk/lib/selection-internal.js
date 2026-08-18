export function parseSelection(value, count) {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'q') return 'quit';
  if (normalized === 'a') return 'all';
  const selected = Number.parseInt(normalized, 10);
  return Number.isInteger(selected) && selected >= 1 && selected <= count ? selected - 1 : null;
}
