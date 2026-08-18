import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
export function AskPanel({ response, onAsk }) {
    const [input, setInput] = useState('');
    const [copied, setCopied] = useState(false);
    const handleSubmit = useCallback(() => {
        const q = input.trim();
        if (q)
            onAsk(q);
    }, [input, onAsk]);
    const handleCopy = useCallback(async (text) => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, []);
    return (_jsxs("div", { children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "card-header", children: _jsx("span", { className: "card-title", children: "Ask about a feature idea" }) }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem' }, children: [_jsx("input", { className: "ask-input", placeholder: "e.g. Add dark mode toggle, Integrate Stripe payments, Add real-time collaboration", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleSubmit() }), _jsx("button", { className: "btn btn-primary", onClick: handleSubmit, children: "Evaluate" })] })] }), response && (_jsxs("div", { className: `verdict ${response.fit ? 'fit' : 'no-fit'}`, children: [_jsx("div", { className: "verdict-badge", children: response.fit ? 'Good fit' : 'Not the best fit' }), _jsx("div", { className: "verdict-reasoning", children: response.reasoning }), response.fit ? (_jsxs("div", { children: [_jsx("div", { className: "verdict-prompt-label", children: "Implementation prompt" }), _jsxs("div", { className: "suggestion-prompt", style: { position: 'relative' }, children: [_jsx("button", { className: "btn btn-sm btn-copy", onClick: () => handleCopy(response.prompt), children: copied ? 'Copied' : 'Copy' }), response.prompt] })] })) : (_jsxs("div", { children: [_jsx("div", { className: "verdict-prompt-label", children: "Better alternative" }), _jsxs("div", { className: "suggestion-prompt", style: { position: 'relative' }, children: [_jsx("button", { className: "btn btn-sm btn-copy", onClick: () => handleCopy(response.alternative), children: copied ? 'Copied' : 'Copy' }), response.alternative] })] }))] }))] }));
}
