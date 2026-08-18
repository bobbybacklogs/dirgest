import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
const MODES = ['balanced', 'growth', 'ux', 'technical', 'wild'];
export function SuggestionPanel({ suggestions, activeMode, onGenerate, onRecord }) {
    const [expanded, setExpanded] = useState(null);
    const [copied, setCopied] = useState(null);
    const handleCopy = useCallback(async (text, index) => {
        await navigator.clipboard.writeText(text);
        setCopied(index);
        setTimeout(() => setCopied(null), 1500);
    }, []);
    return (_jsxs("div", { children: [_jsx("div", { className: "mode-selector", children: MODES.map((mode) => (_jsx("button", { className: `mode-btn ${mode === activeMode ? 'active' : ''}`, onClick: () => onGenerate(mode), children: mode }, mode))) }), suggestions.length === 0 && (_jsx("div", { className: "empty-state", children: _jsx("p", { children: "Select a mode to generate suggestions." }) })), suggestions.map((s, i) => (_jsxs("div", { className: `suggestion-card ${expanded === i ? 'expanded' : ''}`, onClick: () => setExpanded(expanded === i ? null : i), children: [_jsx("div", { className: "suggestion-title", children: s.title }), expanded === i && (_jsxs("div", { className: "suggestion-prompt", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { className: "btn btn-sm btn-copy", onClick: () => handleCopy(s.prompt, i), children: copied === i ? 'Copied' : 'Copy' }), s.prompt, _jsx("div", { style: { marginTop: '0.75rem' }, children: _jsx("button", { className: "btn btn-sm", onClick: () => onRecord(activeMode, s.title), children: "Record selection" }) })] }))] }, i)))] }));
}
