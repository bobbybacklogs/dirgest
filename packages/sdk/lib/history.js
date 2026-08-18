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

export function formatHistoryForPrompt(history) {
  if (!history.length) return '';
  const recent = history.slice(-10);
  const lines = recent.map((entry) => {
    const date = new Date(entry.timestamp).toISOString().slice(0, 10);
    return `- [${date}] (${entry.mode || 'balanced'}) ${entry.title}`;
  });
  return `\n\nPreviously selected suggestions (avoid repeating these areas):\n${lines.join('\n')}`;
}
