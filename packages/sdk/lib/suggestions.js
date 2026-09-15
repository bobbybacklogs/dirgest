import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildCooldownFromConfig, defaultProviders, isMaskedSecret, MemoryKeyStore, ModelHitch, readConfigFile } from 'modelhitch';
import { readHistory, formatHistoryForPrompt } from './history.js';

const FEATURE_SCHEMA = { type: 'object', additionalProperties: false, required: ['suggestions'], properties: { suggestions: { type: 'array', minItems: 4, maxItems: 6, items: { type: 'object', additionalProperties: false, required: ['title', 'prompt'], properties: { title: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9 &/-]{2,59}$' }, prompt: { type: 'string', minLength: 80 } } } } } };
const MODE_INSTRUCTIONS = {
  balanced: 'Balance practical product-next improvements across the project\'s most important user and engineering needs.',
  growth: 'Prioritize activation, retention, and monetization opportunities that fit the existing project.',
  ux: 'Prioritize reducing user friction and improving the end-to-end experience.',
  technical: 'Prioritize architecture, technical debt, maintainability, performance, and reliability improvements.',
  wild: 'Explore genuinely novel but feasible adjacent capabilities, while staying grounded in the supplied project context.'
};

function systemPrompt(mode) {
  return `You are a senior product engineer. The input includes a project analysis summary and a bounded sample of the project's source files. Use the project analysis as your primary reference for the project's type, language, framework, dependencies, and entry points. Cross-reference it with the source sample to confirm your understanding. Before generating any suggestions, determine: (1) what the project is (its purpose, category, and audience), (2) its tech stack, architecture, and conventions, and (3) what it is NOT — do not confuse individual library imports or SDK references with the project's overall identity. For example, a project using Firebase SDKs is not "a Firebase document"; it is whatever the codebase actually builds. Generate exactly 4 to 6 feasible, project-aware feature ideas grounded in that accurate understanding. ${MODE_INSTRUCTIONS[mode]} Each title must contain exactly 3 or 4 words. Each prompt must be a complete, actionable coding prompt that describes scope, relevant existing context, expected behavior, edge cases, and validation. Do not claim integrations or persistence that are absent from the context. Do not misidentify the project's type or category based on individual dependencies. Return only JSON matching the schema.`;
}

function makePrompt(title, project) {
  return `Implement ${title.toLowerCase()} for ${project.name}. Start by reviewing the existing project context and preserve its established structure and conventions. Deliver a complete user-facing workflow with clear empty, loading, validation, success, and error states where relevant. Keep the change scoped, avoid inventing external integrations or persistence, add focused tests for the new behavior, and run the repository's relevant checks.`;
}

function mockSuggestions(project, mode) {
  const titles = {
    balanced: ['Project Health Summary', 'Guided First Run', 'Actionable Error Messages', 'Focused Test Coverage', 'Configuration Input Validation'],
    growth: ['Guided Activation Checklist', 'Returning User Nudges', 'Value Milestone Tracking', 'Upgrade Readiness Signals', 'Referral Sharing Flow'],
    ux: ['Progressive Setup Guidance', 'Clearer Recovery Actions', 'Faster Common Workflows', 'Accessible Status Feedback', 'Contextual Empty States'],
    technical: ['Resilient Error Boundaries', 'Modular Configuration Layer', 'Automated Dependency Audits', 'Reliable Task Retries', 'Performance Regression Checks'],
    wild: ['Natural Language Workflows', 'Project Insight Timeline', 'Adaptive Workspace Assistant', 'Collaborative Review Rooms', 'Predictive Next Actions']
  };
  return titles[mode].map((title) => ({ title, prompt: makePrompt(title, project) }));
}

export function validateSuggestions(payload) {
  const suggestions = payload?.suggestions;
  if (!Array.isArray(suggestions) || suggestions.length < 4 || suggestions.length > 6) throw new Error('Model response must contain 4 to 6 suggestions.');
  const seenPrompts = new Map();
  return suggestions.map((suggestion, index) => {
    const title = suggestion?.title?.trim();
    const prompt = suggestion?.prompt?.trim();
    const wordCount = title?.split(/\s+/).length;
    if (!title || wordCount < 3 || wordCount > 4 || !/^[A-Za-z0-9][A-Za-z0-9 &/-]{2,59}$/.test(title)) throw new Error(`Suggestion ${index + 1} has an invalid title; titles must be 3-4 words.`);
    if (!prompt || prompt.length < 80) throw new Error(`Suggestion ${index + 1} has an incomplete coding prompt.`);
    const duplicateOf = seenPrompts.get(prompt.toLowerCase());
    if (duplicateOf) throw new Error(`Suggestion ${index + 1} reuses the same prompt as "${duplicateOf}"; every suggestion needs its own distinct prompt.`);
    seenPrompts.set(prompt.toLowerCase(), title);
    return { title, prompt };
  });
}

function parseContent(content) {
  if (typeof content !== 'string') throw new Error('Model returned no text content.');
  try { return JSON.parse(content); } catch { throw new Error('Model returned invalid JSON; try again or use --mock.'); }
}

/**
 * Feed a model its own invalid response plus the specific validation failure so a retry has a
 * real chance of fixing the problem instead of reproducing the same mistake.
 */
export function buildCorrectionMessages(rawContent, error) {
  return [
    { role: 'assistant', content: typeof rawContent === 'string' ? rawContent : '' },
    { role: 'user', content: `Your previous response was invalid: ${error.message} Return a corrected JSON object only, strictly matching the schema, making sure every field meets its minimum length requirement.` }
  ];
}

/**
 * ModelHitch V2 keeps OpenAI-compatible credential env names on the private
 * `config` object; Anthropic (and older test stubs) expose them on the provider.
 */
function providerCredentialEnvNames(provider) {
  const primary = provider.apiKeyEnvVar ?? provider.config?.apiKeyEnvVar;
  const fallbacks = provider.apiKeyEnvFallbacks ?? provider.config?.apiKeyEnvFallbacks ?? [];
  return [primary, ...fallbacks].filter(Boolean);
}

function hasConfiguredCredential(provider, environment) {
  return providerCredentialEnvNames(provider).some((name) => Boolean(environment[name]?.trim()));
}

function usablePolicy(hitchConfig) {
  const policy = hitchConfig?.policy;
  if (!policy) return null;
  const trusted = Array.isArray(policy.trusted) ? policy.trusted : [];
  const fallback = Array.isArray(policy.fallback) ? policy.fallback : [];
  if (trusted.length + fallback.length === 0) return null;
  return { ...policy, trusted, fallback };
}

function hasUnmaskedConfigKey(hitchConfig, providerId) {
  const value = hitchConfig?.keys?.[providerId];
  return Boolean(typeof value === 'string' && value.trim() && !isMaskedSecret(value));
}

function hitchConfigHasRouting(hitchConfig) {
  return Boolean(usablePolicy(hitchConfig) || hitchConfig?.defaultProviderId || Object.keys(hitchConfig?.keys || {}).some((providerId) => hasUnmaskedConfigKey(hitchConfig, providerId)));
}

export function modelhitchConfigPath(environment = process.env) {
  const home = environment.MODELHITCH_HOME || join(homedir(), '.modelhitch');
  return join(home, 'config.json');
}

export function loadModelHitchUserConfig(environment = process.env) {
  try {
    return readConfigFile(modelhitchConfigPath(environment));
  } catch {
    return null;
  }
}

export function lanesFromPolicy(policy, providers = []) {
  const usable = usablePolicy({ policy });
  if (!usable) return [];
  const providersById = new Map(providers.map((provider) => [provider.id, provider]));
  const lanes = [];
  const pushEntry = (entry) => {
    if (!entry?.providerId) return;
    const models = entry.models?.length
      ? entry.models
      : [safeDefaultModel(providersById.get(entry.providerId)?.defaultModel)];
    for (const model of models) lanes.push({ providerId: entry.providerId, model });
  };
  for (const entry of usable.trusted) pushEntry(entry);
  for (const entry of usable.fallback) pushEntry(entry);
  return lanes;
}

export function firstRoutingLane(hitchConfig, environment = process.env, providers = defaultProviders) {
  if (environment.DIRGEST_PROVIDER) {
    const selected = providers.find((provider) => provider.id === environment.DIRGEST_PROVIDER);
    return { providerId: environment.DIRGEST_PROVIDER, model: environment.DIRGEST_MODEL || hitchConfig?.defaultModel || safeDefaultModel(selected?.defaultModel) };
  }
  const policy = usablePolicy(hitchConfig);
  if (policy) {
    const [primary] = lanesFromPolicy(policy, providers);
    if (primary) return environment.DIRGEST_MODEL ? { ...primary, model: environment.DIRGEST_MODEL } : primary;
  }
  if (hitchConfig?.defaultProviderId) {
    const selected = providers.find((provider) => provider.id === hitchConfig.defaultProviderId);
    return { providerId: hitchConfig.defaultProviderId, model: environment.DIRGEST_MODEL || hitchConfig.defaultModel || safeDefaultModel(selected?.defaultModel) };
  }
  return null;
}

export async function buildModelHitchClientOptions(hitchConfig, environment = process.env) {
  const keystore = new MemoryKeyStore();
  for (const [providerId, apiKey] of Object.entries(hitchConfig?.keys || {})) {
    if (typeof apiKey === 'string' && apiKey.trim() && !isMaskedSecret(apiKey)) await keystore.set(providerId, apiKey);
  }
  const policy = usablePolicy(hitchConfig);
  const primary = firstRoutingLane(hitchConfig, environment, defaultProviders);
  const options = { keystore };
  if (primary) {
    options.defaultProviderId = primary.providerId;
    options.defaultModel = primary.model;
  }
  if (policy) {
    options.policy = policy;
    try {
      const cooldown = hitchConfig ? buildCooldownFromConfig(hitchConfig) : undefined;
      if (cooldown) options.cooldown = cooldown;
    } catch {
      // Registry autoMode still works if a config cooldown section is incomplete.
    }
    return options;
  }
  options.autoMode = true;
  return options;
}

const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:3939';
/** Free / demo defaults that are commonly rate-limited; prefer a sturdier model when auto-detecting. */
const RATE_LIMITED_DEFAULT_MODELS = new Map([
  ['big-pickle', 'deepseek-v4-flash'],
  ['meta-llama/llama-3.1-8b-instruct:free', 'openai/gpt-4o-mini'],
]);
const BRIDGE_MODEL_PREFERENCES = [
  'deepseek/deepseek-v4-flash',
  'deepseek-v4-flash',
  'openai/gpt-4o-mini',
  'openai/gpt-5.4-mini',
  'gpt-5.6-luna',
  'gpt-5.4-mini',
  'gpt-5.4-nano',
  'anthropic/claude-haiku-4.5',
  'anthropic/claude-haiku-4-5',
  'claude-haiku-4-5',
  'google/gemini-2.5-flash-lite',
  'gemini/models/gemini-3.5-flash-lite',
  'gemini-3.5-flash-lite',
  'big-pickle',
  'mock/mock-model',
];
const BRIDGE_HEALTH_TIMEOUT_MS = 1500;
/** V2 bridges advertise large model catalogs; 1.5s is too tight for /v1/models. */
const BRIDGE_MODELS_TIMEOUT_MS = 15_000;

async function createHitch(environment = process.env, hitchConfig = null) {
  return new ModelHitch(await buildModelHitchClientOptions(hitchConfig, environment));
}

function safeDefaultModel(providerDefault) {
  if (!providerDefault) return 'gpt-4o-mini';
  return RATE_LIMITED_DEFAULT_MODELS.get(providerDefault) || providerDefault;
}

function pickAdvertisedModel(advertisedModelIds, ...candidates) {
  return candidates.find((candidateId) => candidateId && advertisedModelIds.has(candidateId));
}

function routedBridgeModel(hitchConfig, environment = process.env, advertisedModelIds = new Set()) {
  const explicit = environment.DIRGEST_MODEL || environment.DIRGEST_BRIDGE_MODEL;
  if (explicit) return explicit;
  const routing = firstRoutingLane(hitchConfig, environment, defaultProviders);
  if (!routing) return null;
  const qualified = `${routing.providerId}/${routing.model}`;
  return pickAdvertisedModel(advertisedModelIds, qualified, routing.model) || qualified;
}

export function resolveBridgeConfiguration(catalog, environment = process.env, hitchConfig = null) {
  const models = Array.isArray(catalog?.data) ? catalog.data : [];
  const advertisedModelIds = new Set(models.map((candidate) => candidate?.id).filter(Boolean));
  const preferredModel = pickAdvertisedModel(advertisedModelIds, ...BRIDGE_MODEL_PREFERENCES);
  const model = routedBridgeModel(hitchConfig, environment, advertisedModelIds) || preferredModel || models[0]?.id;
  if (!model) return null;
  return { provider: 'openai', model, credentials: { apiKey: 'sk-bridge-local', baseUrl: `${(environment.DIRGEST_BRIDGE_URL || DEFAULT_BRIDGE_URL).replace(/\/+$/, '')}/v1` }, usesModelHitchConfiguration: true };
}

export function bridgeModelCandidates(catalog) {
  const models = Array.isArray(catalog?.data) ? catalog.data : [];
  const advertisedModelIds = new Set(models.map((candidate) => candidate?.id).filter(Boolean));
  const preferred = BRIDGE_MODEL_PREFERENCES.filter((candidateId) => advertisedModelIds.has(candidateId));
  if (preferred.length > 0) return preferred;
  return models[0]?.id ? [models[0].id] : [];
}

export function isRetryableModelError(error) {
  const code = error?.code;
  const status = error?.status;
  return code === 'rate-limited' || code === 'provider-error' || (Number.isInteger(status) && (status === 429 || status >= 500));
}

export async function attemptWithCandidateModels(task, candidates) {
  let lastError;
  for (const candidateModel of candidates) {
    try {
      return { model: candidateModel, result: await task(candidateModel) };
    } catch (error) {
      if (!isRetryableModelError(error)) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error('No model candidates were available.');
}

async function findBridgeConfiguration(environment = process.env, hitchConfig = null) {
  const bridgeUrl = (environment.DIRGEST_BRIDGE_URL || DEFAULT_BRIDGE_URL).replace(/\/+$/, '');
  try {
    const health = await fetch(`${bridgeUrl}/healthz`, { signal: AbortSignal.timeout(BRIDGE_HEALTH_TIMEOUT_MS) });
    if (!health.ok) return null;
    const models = await fetch(`${bridgeUrl}/v1/models`, { signal: AbortSignal.timeout(BRIDGE_MODELS_TIMEOUT_MS) });
    if (!models.ok) return null;
    const catalog = await models.json();
    const configuration = resolveBridgeConfiguration(catalog, environment, hitchConfig);
    if (!configuration) return null;
    return { configuration, candidates: [configuration.model] };
  } catch {
    return null;
  }
}

export function resolveModelConfiguration(hitch, environment = process.env, hitchConfig = null) {
  const routing = firstRoutingLane(hitchConfig, environment, hitch.providers);
  const configuredProvider = hitch.providers.find((provider) => hasConfiguredCredential(provider, environment) || hasUnmaskedConfigKey(hitchConfig, provider.id));
  const provider = routing?.providerId || configuredProvider?.id || 'openai';
  const selectedProvider = hitch.providers.find((candidate) => candidate.id === provider);
  const model = routing?.model || environment.DIRGEST_MODEL || safeDefaultModel(selectedProvider?.defaultModel);
  return { provider, model, usesModelHitchConfiguration: Boolean((configuredProvider || hitchConfigHasRouting(hitchConfig)) && !environment.DIRGEST_PROVIDER) };
}

async function resolveDirectProviderCandidates(hitch, environment = process.env, hitchConfig = null) {
  const configuration = resolveModelConfiguration(hitch, environment, hitchConfig);
  const { provider, usesModelHitchConfiguration } = configuration;
  if (provider === 'openai' && !environment.OPENAI_API_KEY && !usesModelHitchConfiguration) throw new Error('No ModelHitch provider configuration was found. Set a supported provider API key (for example OPENAI_API_KEY or AI_GATEWAY_API_KEY), set DIRGEST_PROVIDER, or use --mock for offline mode.');
  return { configuration, candidates: [configuration.model] };
}

function createBridgeHitch() {
  // Failover belongs to the running ModelHitch bridge; the client must not apply default autoMode lanes.
  return new ModelHitch();
}

// Shared entry point so every SDK capability resolves providers and fallback models identically.
export async function createModelSession(environment = process.env, hitchConfig = undefined) {
  const resolvedConfig = hitchConfig === undefined ? loadModelHitchUserConfig(environment) : hitchConfig;
  if (!environment.DIRGEST_PROVIDER) {
    const bridge = await findBridgeConfiguration(environment, resolvedConfig);
    if (bridge) return { hitch: createBridgeHitch(), configuration: bridge.configuration, candidates: bridge.candidates };
  }
  const hitch = await createHitch(environment, resolvedConfig);
  const { configuration, candidates } = await resolveDirectProviderCandidates(hitch, environment, resolvedConfig);
  return { hitch, configuration, candidates };
}

function buildSuggestionMessages(project, mode, historyContext) {
  const summaryBlock = project.summary ? `\n\nProject analysis:\n${project.summary}` : '';
  const treeBlock = project.crawl && project.tree ? `\n\nFull project layout from crawl:\n${project.tree}` : '';
  return [{ role: 'system', content: systemPrompt(mode) }, { role: 'user', content: `Project metadata:\n${JSON.stringify(project.metadata)}${summaryBlock}${treeBlock}\n\n${project.crawl ? 'Broad cross-directory project sample' : 'Bounded project sample'}:\n${project.sample || '(No readable project files detected.)'}${historyContext}` }];
}

function buildAskMessages(project, question, historyContext) {
  const summaryBlock = project.summary ? `\n\nProject analysis:\n${project.summary}` : '';
  return [{ role: 'system', content: askSystemPrompt() }, { role: 'user', content: `Project metadata:\n${JSON.stringify(project.metadata)}${summaryBlock}\n\nBounded project sample:\n${project.sample || '(No readable project files detected.)'}${historyContext}\n\nFeature idea: ${question.trim()}` }];
}

export async function getSuggestions(project, { mock = false, mode = 'balanced', environment = process.env } = {}) {
  if (!Object.hasOwn(MODE_INSTRUCTIONS, mode)) throw new Error(`Unknown suggestion mode: ${mode}.`);
  if (mock) return mockSuggestions(project, mode);
  const history = await readHistory(project.directory);
  const historyContext = formatHistoryForPrompt(history);
  const { hitch, configuration, candidates } = await createModelSession(environment);
  const { provider, credentials } = configuration;
  try {
    const messages = buildSuggestionMessages(project, mode, historyContext);
    const task = (candidateModel, extraMessages = []) => hitch.chat({ provider, model: candidateModel, messages: [...messages, ...extraMessages], responseFormat: { type: 'json_schema', name: 'dirgest_suggestions', schema: FEATURE_SCHEMA, strict: true }, ...(credentials?.apiKey ? { apiKey: credentials.apiKey } : {}), ...(credentials?.baseUrl ? { baseUrl: credentials.baseUrl } : {}) });
    const { model: successfulModel, result } = await attemptWithCandidateModels(task, candidates);
    const content = result.message?.content;
    try {
      return validateSuggestions(parseContent(content));
    } catch (error) {
      if (!error.message.startsWith('Model response') && !error.message.startsWith('Model returned') && !error.message.startsWith('Suggestion ')) throw error;
      const corrected = await task(successfulModel, buildCorrectionMessages(content, error));
      return validateSuggestions(parseContent(corrected.message?.content));
    }
  } catch (error) {
    if (error.message.startsWith('Model response') || error.message.startsWith('Model returned') || error.message.startsWith('Suggestion ')) throw error;
    if (credentials?.baseUrl) throw new Error(`Could not generate suggestions via the ModelHitch bridge${error.providerId ? ` with provider ${error.providerId}` : ''}: ${error.message}`);
    throw new Error(`Could not generate suggestions with ${provider}: ${error.message}`);
  }
}

// Two mutually exclusive shapes (rather than one shape with optional fields) so a strict
// JSON-schema model can't satisfy the schema while silently omitting "prompt" or "alternative".
const ASK_SCHEMA_FIT = { type: 'object', additionalProperties: false, required: ['fit', 'reasoning', 'prompt'], properties: { fit: { type: 'boolean', enum: [true] }, reasoning: { type: 'string', minLength: 10, maxLength: 500 }, prompt: { type: 'string', minLength: 80 } } };
const ASK_SCHEMA_MISFIT = { type: 'object', additionalProperties: false, required: ['fit', 'reasoning', 'alternative'], properties: { fit: { type: 'boolean', enum: [false] }, reasoning: { type: 'string', minLength: 10, maxLength: 500 }, alternative: { type: 'string', minLength: 80 } } };
const ASK_SCHEMA = { anyOf: [ASK_SCHEMA_FIT, ASK_SCHEMA_MISFIT] };

function askSystemPrompt() {
  return `You are a senior product engineer evaluating a feature idea against a project's codebase. Analyze the supplied project context and determine whether the proposed feature is a good fit.

Return a JSON object with:
- fit: true if the feature makes sense for this project's architecture, tech stack, and purpose; false otherwise.
- reasoning: 1-2 sentences explaining your assessment. If it doesn't fit, acknowledge the feature is a good idea in general but explain why it doesn't match this specific project.
- prompt: ALWAYS required when fit is true, and must be omitted when fit is false. A complete actionable coding prompt (at least 80 characters) describing scope, relevant existing context, expected behavior, edge cases, and validation.
- alternative: ALWAYS required when fit is false, and must be omitted when fit is true. A different feature prompt (at least 80 characters) that would be a better fit for this project.

Be honest. Do not force a fit. Return only JSON matching the schema.`;
}

function mockAskResponse(project, question) {
  const lowerQuestion = question.toLowerCase();
  const isFit = /\b(add|implement|create|build|fix|improve|enhance|update|refactor|add support)\b/.test(lowerQuestion);
  if (isFit) {
    return { fit: true, reasoning: `The proposed feature aligns well with ${project.name}'s architecture and tech stack.`, prompt: `Implement ${question.trim()} for ${project.name}. Start by reviewing the existing project context and preserve its established structure and conventions. Deliver a complete user-facing workflow with clear empty, loading, validation, success, and error states where relevant. Keep the change scoped, avoid inventing external integrations or persistence, add focused tests for the new behavior, and run the repository's relevant checks.` };
  }
  return { fit: false, reasoning: `A ${question.trim()} is a reasonable idea in general, but it doesn't align with ${project.name}'s current architecture or purpose.`, alternative: `Implement a project health summary dashboard for ${project.name} that surfaces key metrics, recent changes, and actionable insights based on the existing codebase structure and conventions.` };
}

export function validateAskResponse(payload) {
  if (typeof payload?.fit !== 'boolean') throw new Error('Ask response must include a boolean "fit" field.');
  if (typeof payload.reasoning !== 'string' || payload.reasoning.trim().length < 10) throw new Error('Ask response must include a "reasoning" string with at least 10 characters.');
  if (payload.fit) {
    if (typeof payload.prompt !== 'string' || payload.prompt.trim().length < 80) throw new Error('Ask response with fit=true must include a "prompt" with at least 80 characters.');
    return { fit: true, reasoning: payload.reasoning.trim(), prompt: payload.prompt.trim() };
  }
  if (typeof payload.alternative !== 'string' || payload.alternative.trim().length < 80) throw new Error('Ask response with fit=false must include an "alternative" with at least 80 characters.');
  return { fit: false, reasoning: payload.reasoning.trim(), alternative: payload.alternative.trim() };
}

export async function getAskResponse(project, question, { mock = false, environment = process.env } = {}) {
  if (!question || typeof question !== 'string' || question.trim().length === 0) throw new Error('A feature question is required.');
  if (mock) return mockAskResponse(project, question);
  const history = await readHistory(project.directory);
  const historyContext = formatHistoryForPrompt(history);
  const { hitch, configuration, candidates } = await createModelSession(environment);
  const { provider, credentials } = configuration;
  try {
    const messages = buildAskMessages(project, question, historyContext);
    const task = (candidateModel, extraMessages = []) => hitch.chat({ provider, model: candidateModel, messages: [...messages, ...extraMessages], responseFormat: { type: 'json_schema', name: 'dirgest_ask', schema: ASK_SCHEMA, strict: true }, ...(credentials?.apiKey ? { apiKey: credentials.apiKey } : {}), ...(credentials?.baseUrl ? { baseUrl: credentials.baseUrl } : {}) });
    const { model: successfulModel, result } = await attemptWithCandidateModels(task, candidates);
    const content = result.message?.content;
    try {
      return validateAskResponse(parseContent(content));
    } catch (error) {
      if (!error.message.startsWith('Ask response')) throw error;
      const corrected = await task(successfulModel, buildCorrectionMessages(content, error));
      return validateAskResponse(parseContent(corrected.message?.content));
    }
  } catch (error) {
    if (error.message.startsWith('Ask response')) throw error;
    if (credentials?.baseUrl) throw new Error(`Could not evaluate feature idea via the ModelHitch bridge${error.providerId ? ` with provider ${error.providerId}` : ''}: ${error.message}`);
    throw new Error(`Could not evaluate feature idea with ${provider}: ${error.message}`);
  }
}
