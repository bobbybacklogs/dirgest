import { useState, useCallback, useMemo } from 'react';
import type { Suggestion, SuggestionMode, Recommendation } from '../types';

interface Props {
  suggestions: Array<Suggestion | Recommendation>;
  activeMode: SuggestionMode;
  mock: boolean;
  generating: boolean;
  savedTitles: Set<string>;
  onGenerate: (mode: SuggestionMode) => void;
  onRecommend: () => void;
  onRecord: (mode: string, title: string, extras?: { verdict?: string; prompt?: string; source?: string }) => void;
}

const MODES: SuggestionMode[] = ['balanced', 'growth', 'ux', 'technical', 'wild', 'ai', 'ai-wild'];

export function SuggestionPanel({
  suggestions,
  activeMode,
  mock,
  generating,
  savedTitles,
  onGenerate,
  onRecommend,
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
              disabled={generating}
              onClick={() => onGenerate(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
        <button className="btn btn-sm" disabled={generating} onClick={() => onGenerate(activeMode)}>
          Generate {activeMode}
        </button>
        <button className="btn btn-sm" disabled={generating} onClick={onRecommend}>
          Recommend top 10
        </button>
      </div>
      {suggestions.length > 0 && (
        <p className="card-subtitle">
          {suggestions.length} ideas in {activeMode}
          {mock ? ' · mock placeholders' : ' · live model'}
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
        const itemMode = 'mode' in s && s.mode ? s.mode : activeMode;
        return (
          <div
            key={`${s.title}-${i}`}
            className={`suggestion-card ${expanded === i ? 'expanded' : ''} ${recorded ? 'recorded' : ''}`}
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <div className="suggestion-title">
              {s.title}
              {'mode' in s && s.mode ? <span className="chip">{s.mode}</span> : null}
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
                    onClick={() => onRecord(itemMode, s.title, {
                      prompt: s.prompt,
                      ...('mode' in s && s.mode ? { source: 'recommend' } : {}),
                    })}
                  >
                    {recorded ? 'Already saved' : 'Save prompt'}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => onRecord(itemMode, s.title, { verdict: 'excluded' })}
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
