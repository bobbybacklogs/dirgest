import type { HistoryEntry } from '../types';

export function savedPromptEntries(history: HistoryEntry[]): HistoryEntry[] {
  return history.filter((entry) => entry.verdict !== 'excluded' && Boolean(entry.prompt?.trim()));
}

export function excludedEntries(history: HistoryEntry[]): HistoryEntry[] {
  return history.filter((entry) => entry.verdict === 'excluded');
}

export function formatSavedPrompts(entries: HistoryEntry[]): string {
  return savedPromptEntries(entries)
    .map((entry, index) => `${index + 1}. ${entry.title} (${entry.mode || 'balanced'})\n${entry.prompt!.trim()}`)
    .join('\n\n');
}

export function savedTitleSet(history: HistoryEntry[]): Set<string> {
  return new Set(savedPromptEntries(history).map((entry) => entry.title.trim().toLowerCase()));
}
