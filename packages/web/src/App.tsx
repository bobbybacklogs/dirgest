import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  ProjectContext,
  Suggestion,
  SuggestionMode,
  AskResponse,
  FeatureReview,
  HistoryEntry,
} from './types';
import * as api from './api/client';
import { ProjectUpload } from './components/ProjectUpload';
import { ProjectView } from './components/ProjectView';
import { SuggestionPanel } from './components/SuggestionPanel';
import { AskPanel } from './components/AskPanel';
import { ReviewPanel } from './components/ReviewPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { SavedPromptsPanel } from './components/SavedPromptsPanel';
import { savedPromptEntries, savedTitleSet } from './lib/history';

type Tab = 'understand' | 'suggest' | 'ask' | 'review' | 'saved' | 'history';

interface ProjectState {
  id: string;
  context: ProjectContext;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'understand', label: 'Overview' },
  { id: 'suggest', label: 'Suggestions' },
  { id: 'ask', label: 'Ask' },
  { id: 'review', label: 'Review' },
  { id: 'saved', label: 'Saved' },
  { id: 'history', label: 'Activity' },
];

function readMockPreference(): boolean {
  try {
    return window.localStorage.getItem('dirgest.offlineMock') === '1';
  } catch {
    return false;
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

export function App() {
  const [project, setProject] = useState<ProjectState | null>(null);
  const [tab, setTab] = useState<Tab>('understand');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeMode, setActiveMode] = useState<SuggestionMode>('balanced');
  const [askResponse, setAskResponse] = useState<AskResponse | null>(null);
  const [review, setReview] = useState<FeatureReview | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mock, setMock] = useState(readMockPreference);
  const generateAbort = useRef<AbortController | null>(null);
  const generateSeq = useRef(0);

  const savedCount = useMemo(() => savedPromptEntries(history).length, [history]);
  const savedTitles = useMemo(() => savedTitleSet(history), [history]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('dirgest.offlineMock', mock ? '1' : '0');
    } catch {
      // Ignore private-mode storage failures.
    }
  }, [mock]);

  const openTab = useCallback((next: Tab) => {
    setTab(next);
    if (next === 'history' || next === 'saved') {
      if (!project) return;
      void api.getHistory(project.id).then((result) => setHistory(result.history)).catch(() => showToast('Failed to load history'));
    }
  }, [project, showToast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.altKey || event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < TABS.length && project) {
        event.preventDefault();
        openTab(TABS[index].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openTab, project]);

  const handleUpload = useCallback(async (files: { path: string; content: string }[]) => {
    setLoading('Analyzing project…');
    try {
      const packageFile = files.find((f) => f.path === 'package.json' || f.path.endsWith('/package.json'));
      const name = packageFile ? JSON.parse(packageFile.content).name : undefined;
      const result = await api.inspectUpload(
        files.map((f) => ({ path: f.path, content: f.content })),
        name,
      );
      setProject({ id: result.id, context: result.context });
      setSuggestions([]);
      setAskResponse(null);
      setReview(null);
      setTab('understand');
      try {
        const recorded = await api.getHistory(result.id);
        setHistory(recorded.history);
      } catch {
        setHistory([]);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(null);
    }
  }, [showToast]);

  const handleGenerateSuggestions = useCallback(
    async (mode: SuggestionMode) => {
      if (!project) return;
      const seq = ++generateSeq.current;
      generateAbort.current?.abort();
      const controller = new AbortController();
      generateAbort.current = controller;
      setActiveMode(mode);
      setTab('suggest');
      setLoading(mock ? `Generating mock ${mode} placeholders…` : `Generating ${mode} suggestions…`);
      try {
        const result = await api.getSuggestions(project.id, mode, mock, controller.signal);
        if (seq !== generateSeq.current) return;
        setSuggestions(result.suggestions);
      } catch (err) {
        if (seq !== generateSeq.current || isAbortError(err)) return;
        showToast(err instanceof Error ? err.message : 'Failed to generate suggestions');
      } finally {
        if (seq === generateSeq.current) setLoading(null);
      }
    },
    [project, showToast, mock],
  );

  const handleAsk = useCallback(
    async (question: string) => {
      if (!project) return;
      setLoading('Evaluating idea…');
      try {
        const result = await api.askQuestion(project.id, question, mock);
        setAskResponse(result.response);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to evaluate');
      } finally {
        setLoading(null);
      }
    },
    [project, showToast, mock],
  );

  const handleReviewFeatures = useCallback(
    async (content: string, filename: string) => {
      if (!project) return;
      setLoading(`Reviewing ${filename}…`);
      try {
        const result = await api.reviewFeatures(project.id, content, filename, mock);
        setReview(result.review);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to review features');
      } finally {
        setLoading(null);
      }
    },
    [project, showToast, mock],
  );

  const handleRecordSelection = useCallback(
    async (mode: string, title: string, extras?: { verdict?: string; question?: string; rejected?: string; prompt?: string }) => {
      if (!project) return;
      try {
        await api.recordHistory(project.id, mode, title, extras);
        const result = await api.getHistory(project.id);
        setHistory(result.history);
        if (extras?.verdict === 'excluded') {
          setSuggestions((current) => current.filter((suggestion) => suggestion.title !== title));
          showToast('Excluded');
        } else {
          showToast('Saved');
        }
      } catch {
        showToast('Failed to record');
      }
    },
    [project, showToast],
  );

  const handleSaveAsk = useCallback(
    async (title: string, question: string, fit: boolean, prompt: string) => {
      await handleRecordSelection('ask', title, {
        verdict: fit ? 'fit' : 'misfit',
        question,
        prompt,
        ...(fit ? {} : { rejected: question }),
      });
    },
    [handleRecordSelection],
  );

  const handleClearHistory = useCallback(async () => {
    if (!project) return;
    try {
      await api.clearHistory(project.id);
      setHistory([]);
      showToast('History cleared');
    } catch {
      showToast('Failed to clear history');
    }
  }, [project, showToast]);

  const handleReset = useCallback(() => {
    setProject(null);
    setSuggestions([]);
    setAskResponse(null);
    setReview(null);
    setHistory([]);
    setTab('understand');
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">dg</span>
          <div>
            <strong>Dirgest</strong>
            <span className="brand-sub">
              {project ? project.context.name : 'Project briefing'}
            </span>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="source-switch" role="group" aria-label="Suggestion source">
            <button
              type="button"
              className={!mock ? 'active' : ''}
              onClick={() => setMock(false)}
            >
              Live
            </button>
            <button
              type="button"
              className={mock ? 'active' : ''}
              onClick={() => setMock(true)}
            >
              Mock
            </button>
          </div>
          {project && (
            <button className="btn btn-sm" onClick={handleReset}>New project</button>
          )}
        </div>
      </header>

      {loading && (
        <div className="status-bar">
          <div className="spinner" />
          {loading}
        </div>
      )}

      <main className="app">
        {!project ? (
          <ProjectUpload onUpload={handleUpload} />
        ) : (
          <>
            <nav className="tabs" aria-label="Workspace">
              {TABS.map((item, index) => (
                <button
                  key={item.id}
                  className={`tab ${tab === item.id ? 'active' : ''}`}
                  title={`Alt+${index + 1}`}
                  onClick={() => openTab(item.id)}
                >
                  <span className="tab-index">{index + 1}</span>
                  {item.label}
                  {item.id === 'saved' && savedCount > 0 && <span className="tab-count">{savedCount}</span>}
                  {item.id === 'suggest' && suggestions.length > 0 && <span className="tab-count">{suggestions.length}</span>}
                  {item.id === 'history' && history.length > 0 && <span className="tab-count">{history.length}</span>}
                </button>
              ))}
            </nav>

            {tab === 'understand' && (
              <ProjectView
                context={project.context}
                history={history}
                review={review}
                suggestionCount={suggestions.length}
                generating={Boolean(loading)}
                onGenerateSuggestions={handleGenerateSuggestions}
                onNavigate={openTab}
              />
            )}
            {tab === 'suggest' && (
              <SuggestionPanel
                suggestions={suggestions}
                activeMode={activeMode}
                mock={mock}
                generating={Boolean(loading)}
                savedTitles={savedTitles}
                onGenerate={handleGenerateSuggestions}
                onRecord={handleRecordSelection}
              />
            )}
            {tab === 'ask' && (
              <AskPanel
                response={askResponse}
                onAsk={handleAsk}
                onSave={handleSaveAsk}
              />
            )}
            {tab === 'review' && (
              <ReviewPanel
                review={review}
                onReview={handleReviewFeatures}
              />
            )}
            {tab === 'saved' && (
              <SavedPromptsPanel history={history} />
            )}
            {tab === 'history' && (
              <HistoryPanel
                history={history}
                onClear={handleClearHistory}
              />
            )}
          </>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
