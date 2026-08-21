import { useState, useCallback } from 'react';
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

type Tab = 'understand' | 'suggest' | 'ask' | 'review' | 'history';

interface ProjectState {
  id: string;
  context: ProjectContext;
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

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleUpload = useCallback(async (files: { path: string; content: string }[]) => {
    setLoading('Analyzing project\u2026');
    try {
      const name = files.find((f) => f.path === 'package.json')
        ? JSON.parse(files.find((f) => f.path === 'package.json')!.content).name
        : undefined;
      const result = await api.inspectUpload(
        files.map((f) => ({ path: f.path, content: f.content })),
        name,
      );
      setProject({ id: result.id, context: result.context });
      setSuggestions([]);
      setAskResponse(null);
      setReview(null);
      setTab('understand');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(null);
    }
  }, [showToast]);

  const handleGenerateSuggestions = useCallback(
    async (mode: SuggestionMode) => {
      if (!project) return;
      setLoading(`Generating ${mode} suggestions\u2026`);
      try {
        const result = await api.getSuggestions(project.id, mode, true);
        setSuggestions(result.suggestions);
        setActiveMode(mode);
        setTab('suggest');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to generate suggestions');
      } finally {
        setLoading(null);
      }
    },
    [project, showToast],
  );

  const handleAsk = useCallback(
    async (question: string) => {
      if (!project) return;
      setLoading('Evaluating idea\u2026');
      try {
        const result = await api.askQuestion(project.id, question, true);
        setAskResponse(result.response);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to evaluate');
      } finally {
        setLoading(null);
      }
    },
    [project, showToast],
  );

  const handleReviewFeatures = useCallback(
    async (content: string, filename: string) => {
      if (!project) return;
      setLoading(`Reviewing ${filename}\u2026`);
      try {
        const result = await api.reviewFeatures(project.id, content, filename, true);
        setReview(result.review);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to review features');
      } finally {
        setLoading(null);
      }
    },
    [project, showToast],
  );

  const handleRecordSelection = useCallback(
    async (mode: string, title: string) => {
      if (!project) return;
      try {
        await api.recordHistory(project.id, mode, title);
        const result = await api.getHistory(project.id);
        setHistory(result.history);
        showToast('Recorded');
      } catch {
        showToast('Failed to record');
      }
    },
    [project, showToast],
  );

  const handleLoadHistory = useCallback(async () => {
    if (!project) return;
    try {
      const result = await api.getHistory(project.id);
      setHistory(result.history);
    } catch {
      showToast('Failed to load history');
    }
  }, [project, showToast]);

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
    <div className="app">
      <header className="header">
        <h1>Dirgest</h1>
        <p>Context-aware project suggestions</p>
      </header>

      {loading && (
        <div className="status-bar">
          <div className="spinner" />
          {loading}
        </div>
      )}

      {!project ? (
        <ProjectUpload onUpload={handleUpload} />
      ) : (
        <>
          <div className="tabs">
            {(['understand', 'suggest', 'ask', 'review', 'history'] as const).map((t) => (
              <button
                key={t}
                className={`tab ${tab === t ? 'active' : ''}`}
                onClick={() => {
                  setTab(t);
                  if (t === 'history') handleLoadHistory();
                }}
              >
                {t === 'understand'
                  ? 'Project'
                  : t === 'suggest'
                    ? 'Suggestions'
                    : t === 'ask'
                      ? 'Ask'
                      : t === 'review'
                        ? 'Review list'
                        : 'History'}
              </button>
            ))}
            <button className="tab" onClick={handleReset} style={{ marginLeft: 'auto' }}>
              New project
            </button>
          </div>

          {tab === 'understand' && (
            <ProjectView
              context={project.context}
              onGenerateSuggestions={handleGenerateSuggestions}
            />
          )}
          {tab === 'suggest' && (
            <SuggestionPanel
              suggestions={suggestions}
              activeMode={activeMode}
              onGenerate={handleGenerateSuggestions}
              onRecord={handleRecordSelection}
            />
          )}
          {tab === 'ask' && (
            <AskPanel
              response={askResponse}
              onAsk={handleAsk}
            />
          )}
          {tab === 'review' && (
            <ReviewPanel
              review={review}
              onReview={handleReviewFeatures}
            />
          )}
          {tab === 'history' && (
            <HistoryPanel
              history={history}
              onClear={handleClearHistory}
            />
          )}
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
