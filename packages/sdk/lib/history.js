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

export async function writeHistory(projectDirectory, entry) {
  const dir = path.join(projectDirectory, HISTORY_DIR);
  await fs.mkdir(dir, { recursive: true });
  const history = await readHistory(projectDirectory);
  history.push({ timestamp: Date.now(), ...entry });
  const trimmed = history.slice(-MAX_HISTORY);
  await fs.writeFile(historyPath(projectDirectory), JSON.stringify(trimmed, null, 2));
  return trimmed;
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
    return { mode: 'ask', title: trimmedQuestion, verdict: 'fit', question: trimmedQuestion };
  }
  return {
    mode: 'ask',
    title: titleFromPrompt(response?.alternative, trimmedQuestion || 'Recommended alternative'),
    verdict: 'misfit',
    question: trimmedQuestion,
    rejected: trimmedQuestion,
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
  return `- [${date}] (${entry.mode || 'balanced'}) ${entry.title}`;
}

export function formatHistoryForPrompt(history) {
  if (!history.length) return '';
  const recent = history.slice(-10);
  return `\n\nPreviously selected suggestions (avoid repeating these areas):\n${recent.map(formatHistoryLine).join('\n')}`;
}
