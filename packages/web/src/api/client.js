const BASE = '';
async function request(path, init) {
    const res = await fetch(`${BASE}${path}`, {
        method: init?.method,
        body: init?.body,
        signal: init?.signal,
        headers: { 'content-type': 'application/json' },
    });
    const body = await res.json();
    if (!body.ok)
        throw new Error(body.error?.message ?? 'Unknown API error');
    return body.data;
}
export async function inspectUpload(files, name) {
    return request('/api/v1/projects/inspect/upload', {
        method: 'POST',
        body: JSON.stringify({ files, name }),
    });
}
export async function getProject(id) {
    return request(`/api/v1/projects/${id}`);
}
export async function getSuggestions(id, mode, mock = false, signal) {
    return request(`/api/v1/projects/${id}/suggestions`, {
        method: 'POST',
        body: JSON.stringify({ mode, mock }),
        signal,
    });
}
export async function getRecommendations(id, count = 10, mock = false, signal) {
    return request(`/api/v1/projects/${id}/recommendations`, {
        method: 'POST',
        body: JSON.stringify({ count, mock }),
        signal,
    });
}
export async function askQuestion(id, question, mock = false) {
    return request(`/api/v1/projects/${id}/ask`, {
        method: 'POST',
        body: JSON.stringify({ question, mock }),
    });
}
export async function reviewFeatures(id, content, filename, mock = false) {
    return request(`/api/v1/projects/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ content, filename, mock }),
    });
}
export async function getHistory(id) {
    return request(`/api/v1/projects/${id}/history`);
}
export async function recordHistory(id, mode, title, extras) {
    await request(`/api/v1/projects/${id}/history`, {
        method: 'POST',
        body: JSON.stringify({ mode, title, ...extras }),
    });
}
export async function clearHistory(id) {
    await request(`/api/v1/projects/${id}/history`, {
        method: 'DELETE',
    });
}
export async function inspectAsync(directory) {
    return request('/api/v1/projects/inspect/async', {
        method: 'POST',
        body: JSON.stringify({ directory }),
    });
}
export async function getJob(id) {
    return request(`/api/v1/jobs/${id}`);
}
