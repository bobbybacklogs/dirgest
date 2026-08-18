import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function formatDate(ts) {
    return new Date(ts).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
export function HistoryPanel({ history, onClear }) {
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "card-header", children: [_jsx("span", { className: "card-title", children: "Suggestion history" }), history.length > 0 && (_jsx("button", { className: "btn btn-sm", onClick: onClear, children: "Clear all" }))] }), history.length === 0 ? (_jsx("div", { className: "empty-state", children: _jsx("p", { children: "No selections recorded yet." }) })) : (_jsx("ul", { className: "history-list", children: history.map((entry, i) => (_jsxs("li", { className: "history-item", children: [_jsx("span", { className: "history-date", children: formatDate(entry.timestamp) }), _jsx("span", { className: "history-mode", children: entry.mode }), _jsx("span", { className: "history-title", children: entry.title })] }, i))) }))] }));
}
