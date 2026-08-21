import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import * as api from './api/client';
import { ProjectUpload } from './components/ProjectUpload';
import { ProjectView } from './components/ProjectView';
import { SuggestionPanel } from './components/SuggestionPanel';
import { AskPanel } from './components/AskPanel';
import { ReviewPanel } from './components/ReviewPanel';
import { HistoryPanel } from './components/HistoryPanel';
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
    const showToast = useCallback((msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2000);
    }, []);
    const handleUpload = useCallback(async (files) => {
        setLoading('Analyzing project\u2026');
        try {
            const name = files.find((f) => f.path === 'package.json')
                ? JSON.parse(files.find((f) => f.path === 'package.json').content).name
                : undefined;
            const result = await api.inspectUpload(files.map((f) => ({ path: f.path, content: f.content })), name);
            setProject({ id: result.id, context: result.context });
            setSuggestions([]);
            setAskResponse(null);
            setReview(null);
            setTab('understand');
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
        setLoading(`Generating ${mode} suggestions\u2026`);
        try {
            const result = await api.getSuggestions(project.id, mode, true);
            setSuggestions(result.suggestions);
            setActiveMode(mode);
            setTab('suggest');
        }
        catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to generate suggestions');
        }
        finally {
            setLoading(null);
        }
    }, [project, showToast]);
    const handleAsk = useCallback(async (question) => {
        if (!project)
            return;
        setLoading('Evaluating idea\u2026');
        try {
            const result = await api.askQuestion(project.id, question, true);
            setAskResponse(result.response);
        }
        catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to evaluate');
        }
        finally {
            setLoading(null);
        }
    }, [project, showToast]);
    const handleReviewFeatures = useCallback(async (content, filename) => {
        if (!project)
            return;
        setLoading(`Reviewing ${filename}\u2026`);
        try {
            const result = await api.reviewFeatures(project.id, content, filename, true);
            setReview(result.review);
        }
        catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to review features');
        }
        finally {
            setLoading(null);
        }
    }, [project, showToast]);
    const handleRecordSelection = useCallback(async (mode, title) => {
        if (!project)
            return;
        try {
            await api.recordHistory(project.id, mode, title);
            const result = await api.getHistory(project.id);
            setHistory(result.history);
            showToast('Recorded');
        }
        catch {
            showToast('Failed to record');
        }
    }, [project, showToast]);
    const handleLoadHistory = useCallback(async () => {
        if (!project)
            return;
        try {
            const result = await api.getHistory(project.id);
            setHistory(result.history);
        }
        catch {
            showToast('Failed to load history');
        }
    }, [project, showToast]);
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
    return (_jsxs("div", { className: "app", children: [_jsxs("header", { className: "header", children: [_jsx("h1", { children: "Dirgest" }), _jsx("p", { children: "Context-aware project suggestions" })] }), loading && (_jsxs("div", { className: "status-bar", children: [_jsx("div", { className: "spinner" }), loading] })), !project ? (_jsx(ProjectUpload, { onUpload: handleUpload })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "tabs", children: [['understand', 'suggest', 'ask', 'review', 'history'].map((t) => (_jsx("button", { className: `tab ${tab === t ? 'active' : ''}`, onClick: () => {
                                    setTab(t);
                                    if (t === 'history')
                                        handleLoadHistory();
                                }, children: t === 'understand'
                                    ? 'Project'
                                    : t === 'suggest'
                                        ? 'Suggestions'
                                        : t === 'ask'
                                            ? 'Ask'
                                            : t === 'review'
                                                ? 'Review list'
                                                : 'History' }, t))), _jsx("button", { className: "tab", onClick: handleReset, style: { marginLeft: 'auto' }, children: "New project" })] }), tab === 'understand' && (_jsx(ProjectView, { context: project.context, onGenerateSuggestions: handleGenerateSuggestions })), tab === 'suggest' && (_jsx(SuggestionPanel, { suggestions: suggestions, activeMode: activeMode, onGenerate: handleGenerateSuggestions, onRecord: handleRecordSelection })), tab === 'ask' && (_jsx(AskPanel, { response: askResponse, onAsk: handleAsk })), tab === 'review' && (_jsx(ReviewPanel, { review: review, onReview: handleReviewFeatures })), tab === 'history' && (_jsx(HistoryPanel, { history: history, onClear: handleClearHistory }))] })), toast && _jsx("div", { className: "toast", children: toast })] }));
}
