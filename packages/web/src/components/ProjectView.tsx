import type { ProjectContext, SuggestionMode } from '../types';

interface Props {
  context: ProjectContext;
  onGenerateSuggestions: (mode: SuggestionMode) => void;
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="context-field">
      <div className="context-label">{label}</div>
      <div className={`context-value ${!value ? 'empty' : ''}`} style={mono ? { fontFamily: 'var(--font-mono)' } : undefined}>
        {value || 'Not detected'}
      </div>
    </div>
  );
}

function DepTags({ label, deps, className }: { label: string; deps: string[]; className?: string }) {
  if (deps.length === 0) return null;
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div className="context-label" style={{ marginBottom: '0.375rem' }}>{label}</div>
      <div className="dep-list">
        {deps.map((d) => (
          <span key={d} className={`dep-tag ${className || ''}`}>{d}</span>
        ))}
      </div>
    </div>
  );
}

export function ProjectView({ context, onGenerateSuggestions }: Props) {
  return (
    <div>
      <div className="card">
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
      </div>

      {context.entryPoints.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Entry points</span>
          </div>
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
        <div className="card">
          <div className="card-header">
            <span className="card-title">Notable dependencies</span>
          </div>
          <DepTags label="Firebase" deps={context.dependencies.firebase} className="firebase" />
          <DepTags label="AWS" deps={context.dependencies.aws} className="aws" />
          <DepTags label="AI / ML" deps={context.dependencies.ai} className="ai" />
        </div>
      )}

      {context.summary && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Analysis</span>
          </div>
          <div className="summary-text">{context.summary}</div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Source files</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
            {context.files.length} files, sorted by priority
          </span>
        </div>
        <div className="file-list">
          {context.files.map((f) => (
            <div key={f.path} className="file-item">
              <span className="file-priority">{f.priority}</span>
              <span>{f.path}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {(['balanced', 'growth', 'ux', 'technical', 'wild'] as const).map((mode) => (
          <button key={mode} className="btn" onClick={() => onGenerateSuggestions(mode)}>
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}
