import { useMemo, useState } from 'react';
import type { HistoryEntry } from '../types';

interface Props {
  history: HistoryEntry[];
  onClear: () => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryPanel({ history, onClear }: Props) {
  const [query, setQuery] = useState('');
  const [showExcluded, setShowExcluded] = useState(true);

  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return history.filter((entry) => {
      if (!showExcluded && entry.verdict === 'excluded') return false;
      if (!needle) return true;
      return `${entry.title} ${entry.mode} ${entry.verdict ?? ''}`.toLowerCase().includes(needle);
    });
  }, [history, query, showExcluded]);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Activity</span>
        {history.length > 0 && (
          <button
            className="btn btn-sm"
            onClick={() => {
              if (window.confirm('Clear all saved selections and exclusions for this project?')) onClear();
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {history.length > 0 && (
        <div className="filter-row">
          <input
            className="filter-input grow"
            placeholder="Filter activity"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <label className="check-label">
            <input
              type="checkbox"
              checked={showExcluded}
              onChange={(event) => setShowExcluded(event.target.checked)}
            />
            Exclusions
          </label>
        </div>
      )}

      {history.length === 0 ? (
        <div className="empty-state">
          <p>No selections recorded yet.</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <p>No activity matches that filter.</p>
        </div>
      ) : (
        <ul className="history-list">
          {entries.map((entry, i) => (
            <li key={i} className={`history-item${entry.verdict === 'excluded' ? ' excluded' : ''}`}>
              <span className="history-date">{formatDate(entry.timestamp)}</span>
              <span className="history-mode">{entry.verdict === 'excluded' ? 'excluded' : entry.mode}</span>
              <span className="history-title">{entry.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
