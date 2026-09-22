import { useState, useCallback, useMemo } from 'react';
import type { Suggestion, SuggestionMode } from '../types';

interface Props {
  suggestions: Suggestion[];
  activeMode: SuggestionMode;
  cachedModes: SuggestionMode[];
  savedTitles: Set<string>;
  onGenerate: (mode: SuggestionMode) => void;
  onShowCached: (mode: SuggestionMode) => void;
  onRecord: (mode: string, title: string, extras?: { verdict?: string; prompt?: string }) => void;
}

const MODES: SuggestionMode[] = ['balanced', 'growth', 'ux', 'technical', 'wild'];

export function SuggestionPanel({
  suggestions,
  activeMode,
  cachedModes,
  savedTitles,
  onGenerate,
  onShowCached,
  onRecord,
}: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const handleCopy = useCallback(async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const counts = useMemo(
    () => ({
      saved: suggestions.filter((s) => savedTitles.has(s.title.trim().toLowerCase())).length,
    }),
    [suggestions, savedTitles],
  );

  return (
    <div>
      <div className="panel-toolbar">
        <div className="mode-selector">
          {MODES.map((mode) => (
            <button
              key={mode}
              className={`mode-btn ${mode === activeMode ? 'active' : ''}`}
              onClick={() => {
                if (mode !== activeMode && cachedModes.includes(mode)) onShowCached(mode);
                else onGenerate(mode);
              }}
            >
              {mode}
            </button>
          ))}
        </div>
        {suggestions.length > 0 && (
          <button className="btn btn-sm" onClick={() => onGenerate(activeMode)}>
            Regenerate {activeMode}
          </button>
        )}
      </div>
      {suggestions.length > 0 && (
        <p className="card-subtitle">
          {suggestions.length} ideas in {activeMode}
          {counts.saved > 0 ? ` · ${counts.saved} already saved` : ''}
        </p>
      )}

      {suggestions.length === 0 && (
        <div className="empty-state">
          <p>Pick a mode to generate suggestions for this project.</p>
        </div>
      )}

      {suggestions.map((s, i) => {
        const recorded = savedTitles.has(s.title.trim().toLowerCase());
        return (
          <div
            key={`${s.title}-${i}`}
            className={`suggestion-card ${expanded === i ? 'expanded' : ''} ${recorded ? 'recorded' : ''}`}
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <div className="suggestion-title">
              {s.title}
              {recorded && <span className="chip">Saved</span>}
            </div>
            {expanded === i && (
              <div className="suggestion-prompt" onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn btn-sm btn-copy"
                  onClick={() => handleCopy(s.prompt, i)}
                >
                  {copied === i ? 'Copied' : 'Copy'}
                </button>
                {s.prompt}
                <div className="prompt-actions">
                  <button
                    className="btn btn-sm"
                    disabled={recorded}
                    onClick={() => onRecord(activeMode, s.title, { prompt: s.prompt })}
                  >
                    {recorded ? 'Already saved' : 'Save prompt'}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => onRecord(activeMode, s.title, { verdict: 'excluded' })}
                  >
                    Exclude
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
