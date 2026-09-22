import { useMemo, useState } from 'react';
import type { FeatureReview, HistoryEntry, ProjectContext, SuggestionMode } from '../types';
import { excludedEntries, savedPromptEntries } from '../lib/history';

interface Props {
  context: ProjectContext;
  history: HistoryEntry[];
  review: FeatureReview | null;
  suggestionCount: number;
  onGenerateSuggestions: (mode: SuggestionMode) => void;
  onNavigate: (tab: 'suggest' | 'ask' | 'review' | 'saved' | 'history') => void;
}

const MODES: SuggestionMode[] = ['balanced', 'growth', 'ux', 'technical', 'wild'];

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="context-field">
      <div className="context-label">{label}</div>
      <div className={`context-value ${!value ? 'empty' : ''}`}>{value || 'Not detected'}</div>
    </div>
  );
}

function DepTags({ label, deps, className }: { label: string; deps: string[]; className?: string }) {
  if (deps.length === 0) return null;
  return (
    <div className="dep-block">
      <div className="context-label">{label}</div>
      <div className="dep-list">
        {deps.map((d) => (
          <span key={d} className={`dep-tag ${className || ''}`}>{d}</span>
        ))}
      </div>
    </div>
  );
}

export function ProjectView({
  context,
  history,
  review,
  suggestionCount,
  onGenerateSuggestions,
  onNavigate,
}: Props) {
  const saved = useMemo(() => savedPromptEntries(history), [history]);
  const excluded = useMemo(() => excludedEntries(history), [history]);
  const [fileQuery, setFileQuery] = useState('');
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const files = useMemo(() => {
    const query = fileQuery.trim().toLowerCase();
    if (!query) return context.files;
    return context.files.filter((file) => file.path.toLowerCase().includes(query));
  }, [context.files, fileQuery]);

  const copySummary = async () => {
    if (!context.summary) return;
    await navigator.clipboard.writeText(context.summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 1500);
  };

  return (
    <div className="dashboard">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="hero-kicker">Project overview</p>
          <h2>{context.name}</h2>
          <p className="hero-lede">
            {[context.detectedProjectType, context.detectedLanguage, context.detectedFramework]
              .filter(Boolean)
              .join(' · ') || 'Type not detected from the current sample.'}
          </p>
          {context.metadata.description && (
            <p className="hero-desc">{context.metadata.description}</p>
          )}
        </div>
        <div className="stat-grid">
          <div className="stat-tile">
            <span className="stat-value">{context.metadata.fileCount}</span>
            <span className="stat-label">Files sampled</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{context.entryPoints.length}</span>
            <span className="stat-label">Entry points</span>
          </div>
          <div className="stat-tile clickable" onClick={() => onNavigate('saved')}>
            <span className="stat-value">{saved.length}</span>
            <span className="stat-label">Saved prompts</span>
          </div>
          <div className="stat-tile clickable" onClick={() => onNavigate('history')}>
            <span className="stat-value">{excluded.length}</span>
            <span className="stat-label">Excluded</span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <span className="card-title">Generate ideas</span>
          {suggestionCount > 0 && (
            <button className="btn btn-sm" onClick={() => onNavigate('suggest')}>
              Open last batch ({suggestionCount})
            </button>
          )}
        </div>
        <div className="mode-selector">
          {MODES.map((mode) => (
            <button key={mode} className="mode-btn" onClick={() => onGenerateSuggestions(mode)}>
              {mode}
            </button>
          ))}
        </div>
        <div className="quick-row">
          <button className="btn" onClick={() => onNavigate('ask')}>Ask if an idea fits</button>
          <button className="btn" onClick={() => onNavigate('review')}>Review a feature list</button>
          <button className="btn" onClick={() => onNavigate('saved')}>Copy saved prompts</button>
        </div>
      </section>

      <div className="dashboard-split">
        <section className="card">
          <div className="card-header">
            <span className="card-title">Recent saved prompts</span>
            <button className="btn btn-sm" onClick={() => onNavigate('saved')}>View all</button>
          </div>
          {saved.length === 0 ? (
            <p className="quiet">Record a suggestion to collect its prompt here.</p>
          ) : (
            <ul className="dash-list">
              {saved.slice(-5).reverse().map((entry, index) => (
                <li key={`${entry.timestamp}-${index}`}>
                  <span className="history-mode">{entry.mode}</span>
                  <span>{entry.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <span className="card-title">Latest activity</span>
            {review && (
              <span className="quiet">{review.fitCount} fit · {review.misfitCount} miss</span>
            )}
          </div>
          {history.length === 0 ? (
            <p className="quiet">Nothing recorded yet.</p>
          ) : (
            <ul className="dash-list">
              {history.slice(-5).reverse().map((entry, index) => (
                <li key={`${entry.timestamp}-${index}`} className={entry.verdict === 'excluded' ? 'excluded' : ''}>
                  <span className="history-mode">{entry.verdict === 'excluded' ? 'excluded' : entry.mode}</span>
                  <span>{entry.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <span className="card-title">What Dirgest thinks this is</span>
        </div>
        <div className="context-grid">
          <Field label="Name" value={context.name} />
          <Field label="Language" value={context.detectedLanguage} />
          <Field label="Framework" value={context.detectedFramework} />
          <Field label="Project type" value={context.detectedProjectType} />
          <Field label="Files" value={String(context.metadata.fileCount)} />
          <Field label="Description" value={context.metadata.description ?? null} />
        </div>
        {context.entryPoints.length > 0 && (
          <div className="stack-gap">
            <div className="context-label">Entry points</div>
            <div className="dep-list">
              {context.entryPoints.map((ep) => (
                <span key={ep} className="dep-tag">{ep}</span>
              ))}
            </div>
          </div>
        )}
        {(context.dependencies.firebase.length > 0 ||
          context.dependencies.aws.length > 0 ||
          context.dependencies.ai.length > 0) && (
          <div className="stack-gap">
            <DepTags label="Firebase" deps={context.dependencies.firebase} className="firebase" />
            <DepTags label="AWS" deps={context.dependencies.aws} className="aws" />
            <DepTags label="AI / ML" deps={context.dependencies.ai} className="ai" />
          </div>
        )}
      </section>

      {context.summary && (
        <section className="card">
          <div className="card-header">
            <button className="card-title as-button" onClick={() => setAnalysisOpen((open) => !open)}>
              Analysis
            </button>
            <div className="header-actions">
              <button className="btn btn-sm" onClick={() => setAnalysisOpen((open) => !open)}>
                {analysisOpen ? 'Hide' : 'Show'}
              </button>
              <button className="btn btn-sm" onClick={() => void copySummary()}>
                {copiedSummary ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          {analysisOpen && <div className="summary-text">{context.summary}</div>}
        </section>
      )}

      <section className="card">
        <div className="card-header">
          <span className="card-title">Source files</span>
          <input
            className="filter-input"
            placeholder="Filter files"
            value={fileQuery}
            onChange={(event) => setFileQuery(event.target.value)}
          />
        </div>
        <p className="card-subtitle">{files.length} of {context.files.length}, sorted by priority</p>
        <div className="file-list">
          {files.map((f) => (
            <div key={f.path} className="file-item">
              <span className="file-priority">{f.priority}</span>
              <span>{f.path}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
