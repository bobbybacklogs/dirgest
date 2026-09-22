import { promises as fs } from 'node:fs';
import path from 'node:path';

const HISTORY_DIR = '.dirgest';
const HISTORY_FILE = 'history.json';
const MAX_HISTORY = 50;

export function historyPath(projectDirectory) {
  return path.join(projectDirectory, HISTORY_DIR, HISTORY_FILE);
}

export async function readHistory(projectDirectory) {
  try {
    const data = await fs.readFile(historyPath(projectDirectory), 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isExcludedEntry(entry) {
  return entry?.verdict === 'excluded';
}

export function excludeHistoryEntry(mode, title) {
  return { mode: mode || 'balanced', title, verdict: 'excluded' };
}

export function withoutExcludedSuggestions(suggestions, history) {
  const excluded = new Set(
    (history || [])
      .filter(isExcludedEntry)
      .map((entry) => String(entry.title || '').trim().toLowerCase())
      .filter(Boolean),
  );
  if (excluded.size === 0) return suggestions;
  return suggestions.filter((suggestion) => !excluded.has(String(suggestion.title || '').trim().toLowerCase()));
}

export async function writeHistory(projectDirectory, entry) {
  const dir = path.join(projectDirectory, HISTORY_DIR);
  await fs.mkdir(dir, { recursive: true });
  const history = await readHistory(projectDirectory);
  if (isExcludedEntry(entry)) {
    const title = String(entry.title || '').trim().toLowerCase();
    if (title && history.some((existing) => isExcludedEntry(existing) && String(existing.title || '').trim().toLowerCase() === title)) {
      return history;
    }
  }
  history.push({ timestamp: Date.now(), ...entry });
  const trimmed = history.slice(-MAX_HISTORY);
  await fs.writeFile(historyPath(projectDirectory), JSON.stringify(trimmed, null, 2));
  return trimmed;
}

export function savedPromptEntries(history) {
  return (history || []).filter((entry) => {
    if (isExcludedEntry(entry)) return false;
    return typeof entry.prompt === 'string' && entry.prompt.trim().length > 0;
  });
}

export function formatSavedPrompts(entries) {
  return savedPromptEntries(entries).map((entry, index) => {
    const mode = entry.mode || 'balanced';
    return `${index + 1}. ${entry.title} (${mode})\n${entry.prompt.trim()}`;
  }).join('\n\n');
}

export async function clearHistory(projectDirectory) {
  await fs.rm(path.join(projectDirectory, HISTORY_DIR), { recursive: true, force: true });
}

const TITLE_MAX = 80;

export function titleFromPrompt(text, fallback = 'Recommended alternative') {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return fallback;
  const sentence = raw.split(/(?<=[.!?])\s+/)[0] || raw;
  const withoutLead = sentence.replace(/^(implement|add|create|build|try this instead:?)\s+/i, '').replace(/[.!?]+$/, '').trim();
  const candidate = withoutLead || sentence || fallback;
  if (candidate.length <= TITLE_MAX) return candidate;
  return `${candidate.slice(0, TITLE_MAX - 3).trimEnd()}...`;
}

export function askHistoryEntry(question, response) {
  const trimmedQuestion = String(question || '').trim();
  if (response?.fit) {
    return {
      mode: 'ask',
      title: trimmedQuestion,
      verdict: 'fit',
      question: trimmedQuestion,
      ...(typeof response.prompt === 'string' && response.prompt.trim() ? { prompt: response.prompt.trim() } : {}),
    };
  }
  const alternative = typeof response?.alternative === 'string' ? response.alternative.trim() : '';
  return {
    mode: 'ask',
    title: titleFromPrompt(response?.alternative, trimmedQuestion || 'Recommended alternative'),
    verdict: 'misfit',
    question: trimmedQuestion,
    rejected: trimmedQuestion,
    ...(alternative ? { prompt: alternative } : {}),
  };
}

function formatHistoryLine(entry) {
  const date = new Date(entry.timestamp).toISOString().slice(0, 10);
  if (entry.verdict === 'misfit' && entry.rejected) {
    return `- [${date}] (ask) Chose "${entry.title}" instead of "${entry.rejected}"`;
  }
  if (entry.verdict === 'fit' && entry.mode === 'ask') {
    return `- [${date}] (ask) Accepted "${entry.title}"`;
  }
  if (isExcludedEntry(entry)) {
    return `- [${date}] (${entry.mode || 'balanced'}) ${entry.title}`;
  }
  return `- [${date}] (${entry.mode || 'balanced'}) ${entry.title}`;
}

export function formatHistoryForPrompt(history) {
  if (!history.length) return '';
  const excluded = history.filter(isExcludedEntry);
  const selected = history.filter((entry) => !isExcludedEntry(entry));
  const parts = [];
  if (selected.length) {
    const recent = selected.slice(-10);
    parts.push(`\n\nPreviously selected suggestions (avoid repeating these areas):\n${recent.map(formatHistoryLine).join('\n')}`);
  }
  if (excluded.length) {
    const recentExcluded = excluded.slice(-20);
    parts.push(`\n\nPreviously excluded suggestions (do not propose these ideas or close variants again):\n${recentExcluded.map(formatHistoryLine).join('\n')}`);
  }
  return parts.join('');
}
