import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useCallback, useRef } from 'react';
const MAX_BYTES = 64 * 1024;
const ACCEPTED = ['.md', '.txt'];
export function ReviewPanel({ review, onReview }) {
    const [filename, setFilename] = useState(null);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(null);
    const inputRef = useRef(null);
    const handleFile = useCallback(async (file) => {
        if (!file)
            return;
        const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
        if (!ACCEPTED.includes(extension)) {
            setError(`Feature files must be ${ACCEPTED.join(' or ')}; received "${file.name}".`);
            setFilename(null);
            return;
        }
        if (file.size > MAX_BYTES) {
            setError(`${file.name} is ${Math.ceil(file.size / 1024)} KB; the limit is ${MAX_BYTES / 1024} KB.`);
            setFilename(null);
            return;
        }
        setError(null);
        setFilename(file.name);
        onReview(await file.text(), file.name);
    }, [onReview]);
    const handleCopy = useCallback(async (key, text) => {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
    }, []);
    return (_jsxs("div", { children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "card-header", children: _jsx("span", { className: "card-title", children: "Review a feature list" }) }), _jsxs("p", { className: "card-subtitle", children: ["Upload a .md or .txt file with one feature per line or list item (max ", MAX_BYTES / 1024, " KB). Each feature is compared against this codebase."] }), _jsx("input", { ref: inputRef, type: "file", accept: ".md,.txt,text/markdown,text/plain", style: { display: 'none' }, onChange: (e) => {
                            void handleFile(e.target.files?.[0]);
                            e.target.value = '';
                        } }), _jsx("button", { className: "btn btn-primary", onClick: () => inputRef.current?.click(), children: filename ? `Reviewing ${filename}` : 'Choose feature file' }), error && _jsx("div", { className: "verdict no-fit", children: error })] }), review && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "card-header", children: _jsx("span", { className: "card-title", children: review.source ?? 'Feature review' }) }), _jsxs("p", { className: "card-subtitle", children: [review.total, " reviewed \u00B7 ", review.fitCount, " good fit \u00B7 ", review.misfitCount, " not a fit"] })] }), review.misfits.length > 0 && (_jsxs("div", { className: "verdict no-fit", children: [_jsxs("div", { className: "verdict-badge", children: ["Not a fit (", review.misfits.length, ")"] }), review.misfits.map((misfit, index) => (_jsxs("div", { style: { marginTop: '1rem' }, children: [_jsx("div", { className: "verdict-prompt-label", children: misfit.feature }), _jsx("div", { className: "verdict-reasoning", children: misfit.reasoning }), _jsxs("div", { className: "suggestion-prompt", style: { position: 'relative' }, children: [_jsx("button", { className: "btn btn-sm btn-copy", onClick: () => handleCopy(`alt-${index}`, misfit.alternative), children: copied === `alt-${index}` ? 'Copied' : 'Copy' }), misfit.alternative] })] }, `${misfit.feature}-${index}`)))] })), review.fits.length > 0 && (_jsxs("div", { className: "verdict fit", children: [_jsxs("div", { className: "verdict-badge", children: ["Good fits (", review.fits.length, ")"] }), review.fits.map((fit, index) => (_jsxs("div", { style: { marginTop: '1rem' }, children: [_jsxs("div", { className: "verdict-prompt-label", children: [index + 1, ". ", fit.title] }), _jsx("div", { className: "verdict-reasoning", children: fit.reasoning }), _jsxs("div", { className: "suggestion-prompt", style: { position: 'relative' }, children: [_jsx("button", { className: "btn btn-sm btn-copy", onClick: () => handleCopy(`fit-${index}`, fit.prompt), children: copied === `fit-${index}` ? 'Copied' : 'Copy' }), fit.prompt] })] }, `${fit.feature}-${index}`)))] }))] }))] }));
}
