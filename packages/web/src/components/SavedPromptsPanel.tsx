import { useState, useCallback, useMemo } from 'react';
import type { HistoryEntry } from '../types';
import { formatSavedPrompts, savedPromptEntries } from '../lib/history';

interface Props {
  history: HistoryEntry[];
}

export function SavedPromptsPanel({ history }: Props) {
  const allEntries = useMemo(() => savedPromptEntries(history), [history]);
  const [copied, setCopied] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('all');

  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allEntries.filter((entry) => {
      if (mode !== 'all' && (entry.mode || 'balanced') !== mode) return false;
      if (!needle) return true;
      return `${entry.title} ${entry.prompt}`.toLowerCase().includes(needle);
    });
  }, [allEntries, query, mode]);

  const handleCopy = useCallback(async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const modes = useMemo(
    () => ['all', ...Array.from(new Set(allEntries.map((entry) => entry.mode || 'balanced')))],
    [allEntries],
  );

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Saved prompts</span>
          {entries.length > 0 && (
            <button
              className="btn btn-sm"
              onClick={() => handleCopy('all', formatSavedPrompts(entries))}
            >
              {copied === 'all' ? 'Copied all' : `Copy all (${entries.length})`}
            </button>
          )}
        </div>
        <p className="card-subtitle">
          Record ideas across modes, then copy every coding prompt in one place.
        </p>
        {allEntries.length > 0 && (
          <div className="filter-row">
            <input
              className="filter-input grow"
              placeholder="Search titles and prompts"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="filter-input"
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              {modes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {allEntries.length === 0 ? (
        <div className="empty-state">
          <p>No saved prompts yet. Generate ideas, open one, and save it.</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <p>No saved prompts match that filter.</p>
        </div>
      ) : (
        entries.map((entry, index) => (
          <div key={`${entry.timestamp}-${index}`} className="suggestion-card expanded saved">
            <div className="suggestion-title">
              {index + 1}. {entry.title}
              <span className="history-mode saved-mode">{entry.mode || 'balanced'}</span>
            </div>
            <div className="suggestion-prompt" onClick={(event) => event.stopPropagation()}>
              <button
                className="btn btn-sm btn-copy"
                onClick={() => handleCopy(String(index), entry.prompt!.trim())}
              >
                {copied === String(index) ? 'Copied' : 'Copy'}
              </button>
              {entry.prompt}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
