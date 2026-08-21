export interface ProjectFile {
  path: string;
  content: string;
  priority?: number;
}

export interface ProjectMetadata {
  packageName: string | undefined;
  description: string | undefined;
  scripts: string[];
  fileCount: number;
}

export interface ProjectDependencies {
  runtime: string[];
  dev: string[];
  firebase: string[];
  aws: string[];
  ai: string[];
}

export interface ProjectContext {
  directory: string;
  name: string;
  summary: string | null;
  metadata: ProjectMetadata;
  sample: string;
  files: ProjectFile[];
  dependencies: ProjectDependencies;
  entryPoints: string[];
  detectedLanguage: string | null;
  detectedFramework: string | null;
  detectedProjectType: string | null;
}

export interface Suggestion {
  title: string;
  prompt: string;
}

export type SuggestionMode = 'balanced' | 'growth' | 'ux' | 'technical' | 'wild';

export interface AskResponseFit {
  fit: true;
  reasoning: string;
  prompt: string;
}

export interface AskResponseNoFit {
  fit: false;
  reasoning: string;
  alternative: string;
}

export type AskResponse = AskResponseFit | AskResponseNoFit;

export interface FeatureFit {
  feature: string;
  title: string;
  reasoning: string;
  prompt: string;
}

export interface FeatureMisfit {
  feature: string;
  reasoning: string;
  alternative: string;
}

export interface FeatureReview {
  source?: string;
  total: number;
  fitCount: number;
  misfitCount: number;
  fits: FeatureFit[];
  misfits: FeatureMisfit[];
}

export interface HistoryEntry {
  timestamp: number;
  mode: string;
  title: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta: { version: string; timestamp: string };
}

export interface InspectResult {
  id: string;
  context: ProjectContext;
}

export interface SuggestionsResult {
  id: string;
  mode: SuggestionMode;
  suggestions: Suggestion[];
}

export interface AskResult {
  id: string;
  response: AskResponse;
}

export interface ReviewResult {
  id: string;
  review: FeatureReview;
}

export interface HistoryResult {
  id: string;
  history: HistoryEntry[];
}

export interface JobResult {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  result?: InspectResult;
  error?: string;
}
