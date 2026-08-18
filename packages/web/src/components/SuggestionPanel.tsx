import { useState, useCallback } from 'react';
import type { Suggestion, SuggestionMode } from '../types';

interface Props {
  suggestions: Suggestion[];
  activeMode: SuggestionMode;
  onGenerate: (mode: SuggestionMode) => void;
  onRecord: (mode: string, title: string) => void;
}

const MODES: SuggestionMode[] = ['balanced', 'growth', 'ux', 'technical', 'wild'];

export function SuggestionPanel({ suggestions, activeMode, onGenerate, onRecord }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const handleCopy = useCallback(async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  return (
    <div>
      <div className="mode-selector">
        {MODES.map((mode) => (
          <button
            key={mode}
            className={`mode-btn ${mode === activeMode ? 'active' : ''}`}
            onClick={() => onGenerate(mode)}
          >
            {mode}
          </button>
        ))}
      </div>

      {suggestions.length === 0 && (
        <div className="empty-state">
          <p>Select a mode to generate suggestions.</p>
        </div>
      )}

      {suggestions.map((s, i) => (
        <div
          key={i}
          className={`suggestion-card ${expanded === i ? 'expanded' : ''}`}
          onClick={() => setExpanded(expanded === i ? null : i)}
        >
          <div className="suggestion-title">{s.title}</div>
          {expanded === i && (
            <div className="suggestion-prompt" onClick={(e) => e.stopPropagation()}>
              <button
                className="btn btn-sm btn-copy"
                onClick={() => handleCopy(s.prompt, i)}
              >
                {copied === i ? 'Copied' : 'Copy'}
              </button>
              {s.prompt}
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  className="btn btn-sm"
                  onClick={() => onRecord(activeMode, s.title)}
                >
                  Record selection
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
