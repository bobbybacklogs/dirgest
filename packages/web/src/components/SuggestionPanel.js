import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useMemo } from 'react';
const MODES = ['balanced', 'growth', 'ux', 'technical', 'wild', 'ai', 'ai-wild'];
export function SuggestionPanel({ suggestions, activeMode, mock, generating, savedTitles, onGenerate, onRecommend, onRecord, }) {
    const [expanded, setExpanded] = useState(null);
    const [copied, setCopied] = useState(null);
    const handleCopy = useCallback(async (text, index) => {
        await navigator.clipboard.writeText(text);
        setCopied(index);
        setTimeout(() => setCopied(null), 1500);
    }, []);
    const counts = useMemo(() => ({
        saved: suggestions.filter((s) => savedTitles.has(s.title.trim().toLowerCase())).length,
    }), [suggestions, savedTitles]);
    return (_jsxs("div", { children: [_jsxs("div", { className: "panel-toolbar", children: [_jsx("div", { className: "mode-selector", children: MODES.map((mode) => (_jsx("button", { className: `mode-btn ${mode === activeMode ? 'active' : ''}`, disabled: generating, onClick: () => onGenerate(mode), children: mode }, mode))) }), _jsxs("button", { className: "btn btn-sm", disabled: generating, onClick: () => onGenerate(activeMode), children: ["Generate ", activeMode] }), _jsx("button", { className: "btn btn-sm", disabled: generating, onClick: onRecommend, children: "Recommend top 10" })] }), suggestions.length > 0 && (_jsxs("p", { className: "card-subtitle", children: [suggestions.length, " ideas in ", activeMode, mock ? ' · mock placeholders' : ' · live model', counts.saved > 0 ? ` · ${counts.saved} already saved` : ''] })), suggestions.length === 0 && (_jsx("div", { className: "empty-state", children: _jsx("p", { children: "Pick a mode to generate suggestions for this project." }) })), suggestions.map((s, i) => {
                const recorded = savedTitles.has(s.title.trim().toLowerCase());
                const itemMode = 'mode' in s && s.mode ? s.mode : activeMode;
                return (_jsxs("div", { className: `suggestion-card ${expanded === i ? 'expanded' : ''} ${recorded ? 'recorded' : ''}`, onClick: () => setExpanded(expanded === i ? null : i), children: [_jsxs("div", { className: "suggestion-title", children: [s.title, 'mode' in s && s.mode ? _jsx("span", { className: "chip", children: s.mode }) : null, recorded && _jsx("span", { className: "chip", children: "Saved" })] }), expanded === i && (_jsxs("div", { className: "suggestion-prompt", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { className: "btn btn-sm btn-copy", onClick: () => handleCopy(s.prompt, i), children: copied === i ? 'Copied' : 'Copy' }), s.prompt, _jsxs("div", { className: "prompt-actions", children: [_jsx("button", { className: "btn btn-sm", disabled: recorded, onClick: () => onRecord(itemMode, s.title, {
                                                prompt: s.prompt,
                                                ...('mode' in s && s.mode ? { source: 'recommend' } : {}),
                                            }), children: recorded ? 'Already saved' : 'Save prompt' }), _jsx("button", { className: "btn btn-sm", onClick: () => onRecord(itemMode, s.title, { verdict: 'excluded' }), children: "Exclude" })] })] }))] }, `${s.title}-${i}`));
            })] }));
}
