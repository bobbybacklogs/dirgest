import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
function formatDate(ts) {
    return new Date(ts).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
export function HistoryPanel({ history, onClear }) {
    const [query, setQuery] = useState('');
    const [showExcluded, setShowExcluded] = useState(true);
    const entries = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return history.filter((entry) => {
            if (!showExcluded && entry.verdict === 'excluded')
                return false;
            if (!needle)
                return true;
            return `${entry.title} ${entry.mode} ${entry.verdict ?? ''}`.toLowerCase().includes(needle);
        });
    }, [history, query, showExcluded]);
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "card-header", children: [_jsx("span", { className: "card-title", children: "Activity" }), history.length > 0 && (_jsx("button", { className: "btn btn-sm", onClick: () => {
                            if (window.confirm('Clear all saved selections and exclusions for this project?'))
                                onClear();
                        }, children: "Clear all" }))] }), history.length > 0 && (_jsxs("div", { className: "filter-row", children: [_jsx("input", { className: "filter-input grow", placeholder: "Filter activity", value: query, onChange: (event) => setQuery(event.target.value) }), _jsxs("label", { className: "check-label", children: [_jsx("input", { type: "checkbox", checked: showExcluded, onChange: (event) => setShowExcluded(event.target.checked) }), "Exclusions"] })] })), history.length === 0 ? (_jsx("div", { className: "empty-state", children: _jsx("p", { children: "No selections recorded yet." }) })) : entries.length === 0 ? (_jsx("div", { className: "empty-state", children: _jsx("p", { children: "No activity matches that filter." }) })) : (_jsx("ul", { className: "history-list", children: entries.map((entry, i) => (_jsxs("li", { className: `history-item${entry.verdict === 'excluded' ? ' excluded' : ''}`, children: [_jsx("span", { className: "history-date", children: formatDate(entry.timestamp) }), _jsx("span", { className: "history-mode", children: entry.verdict === 'excluded' ? 'excluded' : entry.mode }), _jsx("span", { className: "history-title", children: entry.title })] }, i))) }))] }));
}
