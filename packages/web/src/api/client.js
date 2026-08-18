const BASE = '';
async function request(path, init) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'content-type': 'application/json' },
        ...init,
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
export async function getSuggestions(id, mode, mock = false) {
    return request(`/api/v1/projects/${id}/suggestions`, {
        method: 'POST',
        body: JSON.stringify({ mode, mock }),
    });
}
export async function askQuestion(id, question, mock = false) {
    return request(`/api/v1/projects/${id}/ask`, {
        method: 'POST',
        body: JSON.stringify({ question, mock }),
    });
}
export async function getHistory(id) {
    return request(`/api/v1/projects/${id}/history`);
}
export async function recordHistory(id, mode, title) {
    await request(`/api/v1/projects/${id}/history`, {
        method: 'POST',
        body: JSON.stringify({ mode, title }),
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
