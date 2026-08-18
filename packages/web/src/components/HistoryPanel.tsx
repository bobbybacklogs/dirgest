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
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Suggestion history</span>
        {history.length > 0 && (
          <button className="btn btn-sm" onClick={onClear}>
            Clear all
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="empty-state">
          <p>No selections recorded yet.</p>
        </div>
      ) : (
        <ul className="history-list">
          {history.map((entry, i) => (
            <li key={i} className="history-item">
              <span className="history-date">{formatDate(entry.timestamp)}</span>
              <span className="history-mode">{entry.mode}</span>
              <span className="history-title">{entry.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
