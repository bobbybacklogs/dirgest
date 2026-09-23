import { readHistory, formatHistoryForPrompt, withoutExcludedSuggestions } from './history.js';
import {
  SUGGESTION_MODES,
  isValidSuggestionMode,
  getSuggestions,
  createModelSession,
  attemptWithCandidateModels,
  buildCorrectionMessages,
  parseContent,
} from './suggestions.js';

export const DEFAULT_RECOMMENDATION_COUNT = 10;
export const MIN_RECOMMENDATION_COUNT = 5;
export const MAX_RECOMMENDATION_COUNT = 20;

export function normalizeRecommendationCount(count) {
  const parsed = Number.parseInt(String(count ?? DEFAULT_RECOMMENDATION_COUNT), 10);
  if (!Number.isInteger(parsed) || parsed < MIN_RECOMMENDATION_COUNT || parsed > MAX_RECOMMENDATION_COUNT) {
    throw new Error(`Recommendation count must be an integer from ${MIN_RECOMMENDATION_COUNT} to ${MAX_RECOMMENDATION_COUNT}.`);
  }
  return parsed;
}

function recommendationSchema(count) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['recommendations'],
    properties: {
      recommendations: {
        type: 'array',
        minItems: count,
        maxItems: count,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'prompt', 'mode'],
          properties: {
            title: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9 &/-]{2,59}$' },
            prompt: { type: 'string', minLength: 80 },
            mode: { type: 'string', enum: [...SUGGESTION_MODES] },
          },
        },
      },
    },
  };
}

const CATEGORY_GUIDANCE = SUGGESTION_MODES.map((mode) => `- ${mode}`).join('\n');

function recommendSystemPrompt(count) {
  return `You are a senior product engineer. The input includes a project analysis summary and a bounded sample of the project's source files. Use the project analysis as your primary reference for the project's type, language, framework, dependencies, and entry points. Cross-reference it with the source sample to confirm your understanding.

Before generating recommendations, determine: (1) what the project is (its purpose, category, and audience), (2) its tech stack, architecture, and conventions, and (3) what it is NOT.

Generate exactly ${count} top feature recommendations for this project. Draw from ALL of these categories (each recommendation must use one as its mode):
${CATEGORY_GUIDANCE}

Category intent:
- balanced: practical product-next improvements across user and engineering needs
- growth: activation, retention, and monetization opportunities
- ux: reduce friction and improve end-to-end experience
- technical: architecture, debt, maintainability, performance, reliability
- wild: novel but feasible adjacent capabilities
- ai: practical AI enhancements that could benefit from inference APIs, embeddings, classification, RAG, or tool-using agents — stay provider-neutral (no vendor lock-in)
- ai-wild: bold, speculative AI-native capabilities while staying grounded in the project context — provider-neutral

Spread recommendations across categories instead of clustering in one mode. Each title must contain exactly 3 or 4 words. Each prompt must be a complete, actionable coding prompt with scope, relevant context, expected behavior, edge cases, and validation. Do not claim integrations or persistence absent from the context. Return only JSON matching the schema.`;
}

export function validateRecommendations(payload, count) {
  const recommendations = payload?.recommendations;
  if (!Array.isArray(recommendations) || recommendations.length !== count) {
    throw new Error(`Model response must contain exactly ${count} recommendations.`);
  }
  const seenPrompts = new Map();
  return recommendations.map((recommendation, index) => {
    const title = recommendation?.title?.trim();
    const prompt = recommendation?.prompt?.trim();
    const mode = recommendation?.mode;
    const wordCount = title?.split(/\s+/).length;
    if (!title || wordCount < 3 || wordCount > 4 || !/^[A-Za-z0-9][A-Za-z0-9 &/-]{2,59}$/.test(title)) {
      throw new Error(`Recommendation ${index + 1} has an invalid title; titles must be 3-4 words.`);
    }
    if (!prompt || prompt.length < 80) throw new Error(`Recommendation ${index + 1} has an incomplete coding prompt.`);
    if (!isValidSuggestionMode(mode)) throw new Error(`Recommendation ${index + 1} has an invalid mode "${mode}".`);
    const duplicateOf = seenPrompts.get(prompt.toLowerCase());
    if (duplicateOf) throw new Error(`Recommendation ${index + 1} reuses the same prompt as "${duplicateOf}"; every recommendation needs its own distinct prompt.`);
    seenPrompts.set(prompt.toLowerCase(), title);
    return { title, prompt, mode };
  });
}

function interleaveRecommendations(pools, count) {
  const result = [];
  const seenTitles = new Set();
  let round = 0;
  while (result.length < count && round < 100) {
    for (const pool of pools) {
      const item = pool[round];
      if (!item) continue;
      const key = item.title.trim().toLowerCase();
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      result.push(item);
      if (result.length >= count) return result;
    }
    round += 1;
  }
  return result;
}

async function mockRecommendations(project, count) {
  const pools = [];
  for (const mode of SUGGESTION_MODES) {
    const batch = await getSuggestions(project, { mock: true, mode });
    pools.push(batch.map((suggestion) => ({ ...suggestion, mode })));
  }
  return interleaveRecommendations(pools, count);
}

function buildRecommendationMessages(project, count, historyContext) {
  const summaryBlock = project.summary ? `\n\nProject analysis:\n${project.summary}` : '';
  const treeBlock = project.crawl && project.tree ? `\n\nFull project layout from crawl:\n${project.tree}` : '';
  return [
    { role: 'system', content: recommendSystemPrompt(count) },
    {
      role: 'user',
      content: `Project metadata:\n${JSON.stringify(project.metadata)}${summaryBlock}${treeBlock}\n\n${project.crawl ? 'Broad cross-directory project sample' : 'Bounded project sample'}:\n${project.sample || '(No readable project files detected.)'}${historyContext}`,
    },
  ];
}

async function loadHistory(project) {
  if (!project?.directory) return [];
  return readHistory(project.directory);
}

export async function getRecommendations(project, { mock = false, count = DEFAULT_RECOMMENDATION_COUNT, environment = process.env } = {}) {
  const normalizedCount = normalizeRecommendationCount(count);
  const history = await loadHistory(project);
  if (mock) return withoutExcludedSuggestions(await mockRecommendations(project, normalizedCount), history);
  const historyContext = formatHistoryForPrompt(history);
  const { hitch, configuration, candidates } = await createModelSession(environment);
  const { provider, credentials } = configuration;
  try {
    const messages = buildRecommendationMessages(project, normalizedCount, historyContext);
    const schema = recommendationSchema(normalizedCount);
    const task = (candidateModel, extraMessages = []) => hitch.chat({
      provider,
      model: candidateModel,
      messages: [...messages, ...extraMessages],
      responseFormat: { type: 'json_schema', name: 'dirgest_recommendations', schema, strict: true },
      ...(credentials?.apiKey ? { apiKey: credentials.apiKey } : {}),
      ...(credentials?.baseUrl ? { baseUrl: credentials.baseUrl } : {}),
    });
    const { model: successfulModel, result } = await attemptWithCandidateModels(task, candidates);
    const content = result.message?.content;
    try {
      return withoutExcludedSuggestions(validateRecommendations(parseContent(content), normalizedCount), history);
    } catch (error) {
      if (!error.message.startsWith('Model response') && !error.message.startsWith('Model returned') && !error.message.startsWith('Recommendation ')) throw error;
      const corrected = await task(successfulModel, buildCorrectionMessages(content, error));
      return withoutExcludedSuggestions(validateRecommendations(parseContent(corrected.message?.content), normalizedCount), history);
    }
  } catch (error) {
    if (error.message.startsWith('Model response') || error.message.startsWith('Model returned') || error.message.startsWith('Recommendation ')) throw error;
    if (credentials?.baseUrl) throw new Error(`Could not generate recommendations via the ModelHitch bridge${error.providerId ? ` with provider ${error.providerId}` : ''}: ${error.message}`);
    throw new Error(`Could not generate recommendations with ${provider}: ${error.message}`);
  }
}
