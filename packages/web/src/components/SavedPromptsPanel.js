import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useMemo } from 'react';
import { formatSavedPrompts, savedPromptEntries } from '../lib/history';
export function SavedPromptsPanel({ history }) {
    const allEntries = useMemo(() => savedPromptEntries(history), [history]);
    const [copied, setCopied] = useState(null);
    const [query, setQuery] = useState('');
    const [mode, setMode] = useState('all');
    const entries = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return allEntries.filter((entry) => {
            if (mode !== 'all' && (entry.mode || 'balanced') !== mode)
                return false;
            if (!needle)
                return true;
            return `${entry.title} ${entry.prompt}`.toLowerCase().includes(needle);
        });
    }, [allEntries, query, mode]);
    const handleCopy = useCallback(async (key, text) => {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
    }, []);
    const modes = useMemo(() => ['all', ...Array.from(new Set(allEntries.map((entry) => entry.mode || 'balanced')))], [allEntries]);
    return (_jsxs("div", { children: [_jsxs("div", { className: "card", children: [_jsxs("div", { className: "card-header", children: [_jsx("span", { className: "card-title", children: "Saved prompts" }), entries.length > 0 && (_jsx("button", { className: "btn btn-sm", onClick: () => handleCopy('all', formatSavedPrompts(entries)), children: copied === 'all' ? 'Copied all' : `Copy all (${entries.length})` }))] }), _jsx("p", { className: "card-subtitle", children: "Record ideas across modes, then copy every coding prompt in one place." }), allEntries.length > 0 && (_jsxs("div", { className: "filter-row", children: [_jsx("input", { className: "filter-input grow", placeholder: "Search titles and prompts", value: query, onChange: (event) => setQuery(event.target.value) }), _jsx("select", { className: "filter-input", value: mode, onChange: (event) => setMode(event.target.value), children: modes.map((item) => (_jsx("option", { value: item, children: item }, item))) })] }))] }), allEntries.length === 0 ? (_jsx("div", { className: "empty-state", children: _jsx("p", { children: "No saved prompts yet. Generate ideas, open one, and save it." }) })) : entries.length === 0 ? (_jsx("div", { className: "empty-state", children: _jsx("p", { children: "No saved prompts match that filter." }) })) : (entries.map((entry, index) => (_jsxs("div", { className: "suggestion-card expanded saved", children: [_jsxs("div", { className: "suggestion-title", children: [index + 1, ". ", entry.title, _jsx("span", { className: "history-mode saved-mode", children: entry.mode || 'balanced' })] }), _jsxs("div", { className: "suggestion-prompt", onClick: (event) => event.stopPropagation(), children: [_jsx("button", { className: "btn btn-sm btn-copy", onClick: () => handleCopy(String(index), entry.prompt.trim()), children: copied === String(index) ? 'Copied' : 'Copy' }), entry.prompt] })] }, `${entry.timestamp}-${index}`))))] }));
}
