import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useMemo } from 'react';
function savedEntries(history) {
    return history.filter((entry) => entry.verdict !== 'excluded' && Boolean(entry.prompt?.trim()));
}
function formatAll(entries) {
    return entries
        .map((entry, index) => `${index + 1}. ${entry.title} (${entry.mode || 'balanced'})\n${entry.prompt.trim()}`)
        .join('\n\n');
}
export function SavedPromptsPanel({ history }) {
    const entries = useMemo(() => savedEntries(history), [history]);
    const [copied, setCopied] = useState(null);
    const handleCopy = useCallback(async (key, text) => {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
    }, []);
    return (_jsxs("div", { children: [_jsxs("div", { className: "card", children: [_jsxs("div", { className: "card-header", children: [_jsx("span", { className: "card-title", children: "Saved prompts" }), entries.length > 0 && (_jsx("button", { className: "btn btn-sm", onClick: () => handleCopy('all', formatAll(entries)), children: copied === 'all' ? 'Copied all' : `Copy all (${entries.length})` }))] }), _jsx("p", { className: "card-subtitle", children: "Record suggestions across modes, then copy every coding prompt from this project in one place." })] }), entries.length === 0 ? (_jsx("div", { className: "empty-state", children: _jsx("p", { children: "No saved prompts yet. Generate ideas, open one, and record the selection." }) })) : (entries.map((entry, index) => (_jsxs("div", { className: "suggestion-card expanded saved", children: [_jsxs("div", { className: "suggestion-title", children: [index + 1, ". ", entry.title, _jsx("span", { className: "history-mode saved-mode", children: entry.mode || 'balanced' })] }), _jsxs("div", { className: "suggestion-prompt", onClick: (event) => event.stopPropagation(), children: [_jsx("button", { className: "btn btn-sm btn-copy", onClick: () => handleCopy(String(index), entry.prompt.trim()), children: copied === String(index) ? 'Copied' : 'Copy' }), entry.prompt] })] }, `${entry.timestamp}-${index}`))))] }));
}
