import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import * as api from './api/client';
import { ProjectUpload } from './components/ProjectUpload';
import { ProjectView } from './components/ProjectView';
import { SuggestionPanel } from './components/SuggestionPanel';
import { AskPanel } from './components/AskPanel';
import { ReviewPanel } from './components/ReviewPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { SavedPromptsPanel } from './components/SavedPromptsPanel';
import { savedPromptEntries, savedTitleSet } from './lib/history';
const TABS = [
    { id: 'understand', label: 'Overview' },
    { id: 'suggest', label: 'Suggestions' },
    { id: 'ask', label: 'Ask' },
    { id: 'review', label: 'Review' },
    { id: 'saved', label: 'Saved' },
    { id: 'history', label: 'Activity' },
];
function readMockPreference() {
    try {
        return window.localStorage.getItem('dirgest.offlineMock') === '1';
    }
    catch {
        return false;
    }
}
function isAbortError(err) {
    return err instanceof Error && err.name === 'AbortError';
}
export function App() {
    const [project, setProject] = useState(null);
    const [tab, setTab] = useState('understand');
    const [suggestions, setSuggestions] = useState([]);
    const [activeMode, setActiveMode] = useState('balanced');
    const [askResponse, setAskResponse] = useState(null);
    const [review, setReview] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(null);
    const [toast, setToast] = useState(null);
    const [mock, setMock] = useState(readMockPreference);
    const generateAbort = useRef(null);
    const generateSeq = useRef(0);
    const savedCount = useMemo(() => savedPromptEntries(history).length, [history]);
    const savedTitles = useMemo(() => savedTitleSet(history), [history]);
    const showToast = useCallback((msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2200);
    }, []);
    useEffect(() => {
        try {
            window.localStorage.setItem('dirgest.offlineMock', mock ? '1' : '0');
        }
        catch {
            // Ignore private-mode storage failures.
        }
    }, [mock]);
    const openTab = useCallback((next) => {
        setTab(next);
        if (next === 'history' || next === 'saved') {
            if (!project)
                return;
            void api.getHistory(project.id).then((result) => setHistory(result.history)).catch(() => showToast('Failed to load history'));
        }
    }, [project, showToast]);
    useEffect(() => {
        const onKey = (event) => {
            if (!(event.altKey || event.metaKey))
                return;
            const target = event.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable))
                return;
            const index = Number(event.key) - 1;
            if (index >= 0 && index < TABS.length && project) {
                event.preventDefault();
                openTab(TABS[index].id);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [openTab, project]);
    const handleUpload = useCallback(async (files) => {
        setLoading('Analyzing project…');
        try {
            const packageFile = files.find((f) => f.path === 'package.json' || f.path.endsWith('/package.json'));
            const name = packageFile ? JSON.parse(packageFile.content).name : undefined;
            const result = await api.inspectUpload(files.map((f) => ({ path: f.path, content: f.content })), name);
            setProject({ id: result.id, context: result.context });
            setSuggestions([]);
            setAskResponse(null);
            setReview(null);
            setTab('understand');
            try {
                const recorded = await api.getHistory(result.id);
                setHistory(recorded.history);
            }
            catch {
                setHistory([]);
            }
        }
        catch (err) {
            showToast(err instanceof Error ? err.message : 'Upload failed');
        }
        finally {
            setLoading(null);
        }
    }, [showToast]);
    const handleGenerateSuggestions = useCallback(async (mode) => {
        if (!project)
            return;
        const seq = ++generateSeq.current;
        generateAbort.current?.abort();
        const controller = new AbortController();
        generateAbort.current = controller;
        setActiveMode(mode);
        setTab('suggest');
        setLoading(mock ? `Generating mock ${mode} placeholders…` : `Generating ${mode} suggestions…`);
        try {
            const result = await api.getSuggestions(project.id, mode, mock, controller.signal);
            if (seq !== generateSeq.current)
                return;
            setSuggestions(result.suggestions);
        }
        catch (err) {
            if (seq !== generateSeq.current || isAbortError(err))
                return;
            showToast(err instanceof Error ? err.message : 'Failed to generate suggestions');
        }
        finally {
            if (seq === generateSeq.current)
                setLoading(null);
        }
    }, [project, showToast, mock]);
    const handleAsk = useCallback(async (question) => {
        if (!project)
            return;
        setLoading('Evaluating idea…');
        try {
            const result = await api.askQuestion(project.id, question, mock);
            setAskResponse(result.response);
        }
        catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to evaluate');
        }
        finally {
            setLoading(null);
        }
    }, [project, showToast, mock]);
    const handleReviewFeatures = useCallback(async (content, filename) => {
        if (!project)
            return;
        setLoading(`Reviewing ${filename}…`);
        try {
            const result = await api.reviewFeatures(project.id, content, filename, mock);
            setReview(result.review);
        }
        catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to review features');
        }
        finally {
            setLoading(null);
        }
    }, [project, showToast, mock]);
    const handleRecordSelection = useCallback(async (mode, title, extras) => {
        if (!project)
            return;
        try {
            await api.recordHistory(project.id, mode, title, extras);
            const result = await api.getHistory(project.id);
            setHistory(result.history);
            if (extras?.verdict === 'excluded') {
                setSuggestions((current) => current.filter((suggestion) => suggestion.title !== title));
                showToast('Excluded');
            }
            else {
                showToast('Saved');
            }
        }
        catch {
            showToast('Failed to record');
        }
    }, [project, showToast]);
    const handleSaveAsk = useCallback(async (title, question, fit, prompt) => {
        await handleRecordSelection('ask', title, {
            verdict: fit ? 'fit' : 'misfit',
            question,
            prompt,
            ...(fit ? {} : { rejected: question }),
        });
    }, [handleRecordSelection]);
    const handleClearHistory = useCallback(async () => {
        if (!project)
            return;
        try {
            await api.clearHistory(project.id);
            setHistory([]);
            showToast('History cleared');
        }
        catch {
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
    return (_jsxs("div", { className: "app-shell", children: [_jsxs("header", { className: "topbar", children: [_jsxs("div", { className: "brand", children: [_jsx("span", { className: "brand-mark", children: "dg" }), _jsxs("div", { children: [_jsx("strong", { children: "Dirgest" }), _jsx("span", { className: "brand-sub", children: project ? project.context.name : 'Project briefing' })] })] }), _jsxs("div", { className: "topbar-actions", children: [_jsxs("div", { className: "source-switch", role: "group", "aria-label": "Suggestion source", children: [_jsx("button", { type: "button", className: !mock ? 'active' : '', onClick: () => setMock(false), children: "Live" }), _jsx("button", { type: "button", className: mock ? 'active' : '', onClick: () => setMock(true), children: "Mock" })] }), project && (_jsx("button", { className: "btn btn-sm", onClick: handleReset, children: "New project" }))] })] }), loading && (_jsxs("div", { className: "status-bar", children: [_jsx("div", { className: "spinner" }), loading] })), _jsx("main", { className: "app", children: !project ? (_jsx(ProjectUpload, { onUpload: handleUpload })) : (_jsxs(_Fragment, { children: [_jsx("nav", { className: "tabs", "aria-label": "Workspace", children: TABS.map((item, index) => (_jsxs("button", { className: `tab ${tab === item.id ? 'active' : ''}`, title: `Alt+${index + 1}`, onClick: () => openTab(item.id), children: [_jsx("span", { className: "tab-index", children: index + 1 }), item.label, item.id === 'saved' && savedCount > 0 && _jsx("span", { className: "tab-count", children: savedCount }), item.id === 'suggest' && suggestions.length > 0 && _jsx("span", { className: "tab-count", children: suggestions.length }), item.id === 'history' && history.length > 0 && _jsx("span", { className: "tab-count", children: history.length })] }, item.id))) }), tab === 'understand' && (_jsx(ProjectView, { context: project.context, history: history, review: review, suggestionCount: suggestions.length, generating: Boolean(loading), onGenerateSuggestions: handleGenerateSuggestions, onNavigate: openTab })), tab === 'suggest' && (_jsx(SuggestionPanel, { suggestions: suggestions, activeMode: activeMode, mock: mock, generating: Boolean(loading), savedTitles: savedTitles, onGenerate: handleGenerateSuggestions, onRecord: handleRecordSelection })), tab === 'ask' && (_jsx(AskPanel, { response: askResponse, onAsk: handleAsk, onSave: handleSaveAsk })), tab === 'review' && (_jsx(ReviewPanel, { review: review, onReview: handleReviewFeatures })), tab === 'saved' && (_jsx(SavedPromptsPanel, { history: history })), tab === 'history' && (_jsx(HistoryPanel, { history: history, onClear: handleClearHistory }))] })) }), toast && _jsx("div", { className: "toast", children: toast })] }));
}
