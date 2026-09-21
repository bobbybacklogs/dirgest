import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
function titleFromAsk(question, response) {
    if (response.fit)
        return question.trim();
    const sentence = response.alternative.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/)[0] || response.alternative;
    const cleaned = sentence.replace(/^(implement|add|create|build|try this instead:?)\s+/i, '').replace(/[.!?]+$/, '').trim();
    const title = cleaned || question.trim();
    return title.length > 80 ? `${title.slice(0, 77).trimEnd()}...` : title;
}
export function AskPanel({ response, onAsk, onSave }) {
    const [input, setInput] = useState('');
    const [copied, setCopied] = useState(false);
    const [lastQuestion, setLastQuestion] = useState('');
    const [saved, setSaved] = useState(false);
    const handleSubmit = useCallback(() => {
        const q = input.trim();
        if (q) {
            setLastQuestion(q);
            setSaved(false);
            onAsk(q);
        }
    }, [input, onAsk]);
    const handleCopy = useCallback(async (text) => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, []);
    return (_jsxs("div", { children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "card-header", children: _jsx("span", { className: "card-title", children: "Ask about a feature idea" }) }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem' }, children: [_jsx("input", { className: "ask-input", placeholder: "e.g. Add dark mode toggle, Integrate Stripe payments, Add real-time collaboration", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleSubmit() }), _jsx("button", { className: "btn btn-primary", onClick: handleSubmit, children: "Evaluate" })] })] }), response && (_jsxs("div", { className: `verdict ${response.fit ? 'fit' : 'no-fit'}`, children: [_jsx("div", { className: "verdict-badge", children: response.fit ? 'Good fit' : 'Not the best fit' }), _jsx("div", { className: "verdict-reasoning", children: response.reasoning }), response.fit ? (_jsxs("div", { children: [_jsx("div", { className: "verdict-prompt-label", children: "Implementation prompt" }), _jsxs("div", { className: "suggestion-prompt", style: { position: 'relative' }, children: [_jsx("button", { className: "btn btn-sm btn-copy", onClick: () => handleCopy(response.prompt), children: copied ? 'Copied' : 'Copy' }), response.prompt] }), onSave && (_jsx("div", { style: { marginTop: '0.75rem' }, children: _jsx("button", { className: "btn btn-sm", disabled: saved, onClick: () => {
                                        onSave(titleFromAsk(lastQuestion, response), lastQuestion, true);
                                        setSaved(true);
                                    }, children: saved ? 'Saved' : 'Remember this idea' }) }))] })) : (_jsxs("div", { children: [_jsx("div", { className: "verdict-prompt-label", children: "Better alternative" }), _jsxs("div", { className: "suggestion-prompt", style: { position: 'relative' }, children: [_jsx("button", { className: "btn btn-sm btn-copy", onClick: () => handleCopy(response.alternative), children: copied ? 'Copied' : 'Copy' }), response.alternative] }), onSave && (_jsx("div", { style: { marginTop: '0.75rem' }, children: _jsx("button", { className: "btn btn-sm", disabled: saved, onClick: () => {
                                        onSave(titleFromAsk(lastQuestion, response), lastQuestion, false);
                                        setSaved(true);
                                    }, children: saved ? 'Saved' : 'Remember this alternative' }) }))] }))] }))] }));
}
