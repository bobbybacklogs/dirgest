export function savedPromptEntries(history) {
    return history.filter((entry) => entry.verdict !== 'excluded' && Boolean(entry.prompt?.trim()));
}
export function excludedEntries(history) {
    return history.filter((entry) => entry.verdict === 'excluded');
}
export function formatSavedPrompts(entries) {
    return savedPromptEntries(entries)
        .map((entry, index) => `${index + 1}. ${entry.title} (${entry.mode || 'balanced'})\n${entry.prompt.trim()}`)
        .join('\n\n');
}
export function savedTitleSet(history) {
    return new Set(savedPromptEntries(history).map((entry) => entry.title.trim().toLowerCase()));
}
