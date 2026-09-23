import type {
  ApiResponse,
  InspectResult,
  SuggestionsResult,
  RecommendationsResult,
  SuggestionMode,
  AskResult,
  ReviewResult,
  HistoryResult,
  JobResult,
  ProjectFile,
} from '../types';

const BASE = '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method,
    body: init?.body,
    signal: init?.signal,
    headers: { 'content-type': 'application/json' },
  });
  const body: ApiResponse<T> = await res.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Unknown API error');
  return body.data as T;
}

export async function inspectUpload(
  files: ProjectFile[],
  name?: string,
): Promise<InspectResult> {
  return request<InspectResult>('/api/v1/projects/inspect/upload', {
    method: 'POST',
    body: JSON.stringify({ files, name }),
  });
}

export async function getProject(id: string): Promise<InspectResult> {
  return request<InspectResult>(`/api/v1/projects/${id}`);
}

export async function getSuggestions(
  id: string,
  mode: SuggestionMode,
  mock = false,
  signal?: AbortSignal,
): Promise<SuggestionsResult> {
  return request<SuggestionsResult>(`/api/v1/projects/${id}/suggestions`, {
    method: 'POST',
    body: JSON.stringify({ mode, mock }),
    signal,
  });
}

export async function getRecommendations(
  id: string,
  count = 10,
  mock = false,
  signal?: AbortSignal,
): Promise<RecommendationsResult> {
  return request<RecommendationsResult>(`/api/v1/projects/${id}/recommendations`, {
    method: 'POST',
    body: JSON.stringify({ count, mock }),
    signal,
  });
}

export async function askQuestion(
  id: string,
  question: string,
  mock = false,
): Promise<AskResult> {
  return request<AskResult>(`/api/v1/projects/${id}/ask`, {
    method: 'POST',
    body: JSON.stringify({ question, mock }),
  });
}

export async function reviewFeatures(
  id: string,
  content: string,
  filename: string,
  mock = false,
): Promise<ReviewResult> {
  return request<ReviewResult>(`/api/v1/projects/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ content, filename, mock }),
  });
}

export async function getHistory(id: string): Promise<HistoryResult> {
  return request<HistoryResult>(`/api/v1/projects/${id}/history`);
}

export async function recordHistory(
  id: string,
  mode: string,
  title: string,
  extras?: { verdict?: string; question?: string; rejected?: string; prompt?: string; source?: string },
): Promise<void> {
  await request<{ recorded: boolean }>(`/api/v1/projects/${id}/history`, {
    method: 'POST',
    body: JSON.stringify({ mode, title, ...extras }),
  });
}

export async function clearHistory(id: string): Promise<void> {
  await request<{ cleared: boolean }>(`/api/v1/projects/${id}/history`, {
    method: 'DELETE',
  });
}

export async function inspectAsync(
  directory: string,
): Promise<JobResult> {
  return request<JobResult>('/api/v1/projects/inspect/async', {
    method: 'POST',
    body: JSON.stringify({ directory }),
  });
}

export async function getJob(id: string): Promise<JobResult> {
  return request<JobResult>(`/api/v1/jobs/${id}`);
}
