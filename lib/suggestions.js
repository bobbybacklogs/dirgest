import { ModelHitch } from 'modelhitch';

const FEATURE_SCHEMA = { type: 'object', additionalProperties: false, required: ['suggestions'], properties: { suggestions: { type: 'array', minItems: 4, maxItems: 6, items: { type: 'object', additionalProperties: false, required: ['title', 'prompt'], properties: { title: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9 &/-]{2,59}$' }, prompt: { type: 'string', minLength: 80 } } } } } };
const MODE_INSTRUCTIONS = {
  balanced: 'Balance practical product-next improvements across the project’s most important user and engineering needs.',
  growth: 'Prioritize activation, retention, and monetization opportunities that fit the existing project.',
  ux: 'Prioritize reducing user friction and improving the end-to-end experience.',
  technical: 'Prioritize architecture, technical debt, maintainability, performance, and reliability improvements.',
  wild: 'Explore genuinely novel but feasible adjacent capabilities, while staying grounded in the supplied project context.'
};

function systemPrompt(mode) {
  return `You are a senior product engineer. Generate exactly 4 to 6 feasible, project-aware feature ideas from the supplied bounded local project context. ${MODE_INSTRUCTIONS[mode]} Each title must contain exactly 3 or 4 words. Each prompt must be a complete, actionable coding prompt that describes scope, relevant existing context, expected behavior, edge cases, and validation. Do not claim integrations or persistence that are absent from the context. Return only JSON matching the schema.`;
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
  return suggestions.map((suggestion, index) => {
    const title = suggestion?.title?.trim();
    const prompt = suggestion?.prompt?.trim();
    const wordCount = title?.split(/\s+/).length;
    if (!title || wordCount < 3 || wordCount > 4 || !/^[A-Za-z0-9][A-Za-z0-9 &/-]{2,59}$/.test(title)) throw new Error(`Suggestion ${index + 1} has an invalid title; titles must be 3-4 words.`);
    if (!prompt || prompt.length < 80) throw new Error(`Suggestion ${index + 1} has an incomplete coding prompt.`);
    return { title, prompt };
  });
}

function parseContent(content) {
  if (typeof content !== 'string') throw new Error('Model returned no text content.');
  try { return JSON.parse(content); } catch { throw new Error('Model returned invalid JSON; try again or use --mock.'); }
}

function hasConfiguredCredential(provider, environment) {
  const names = [provider.apiKeyEnvVar, ...(provider.apiKeyEnvFallbacks || [])].filter(Boolean);
  return names.some((name) => Boolean(environment[name]?.trim()));
}

const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:3939';

export function resolveBridgeConfiguration(catalog, environment = process.env) {
  const models = Array.isArray(catalog?.data) ? catalog.data : [];
  const defaultModel = models.find((model) => model.id === 'big-pickle')?.id || models[0]?.id;
  const model = environment.DIRGEST_MODEL || environment.DIRGEST_BRIDGE_MODEL || defaultModel;
  if (!model) return null;
  return { provider: 'openai', model, credentials: { apiKey: 'sk-bridge-local', baseUrl: `${(environment.DIRGEST_BRIDGE_URL || DEFAULT_BRIDGE_URL).replace(/\/+$/, '')}/v1` }, usesModelHitchConfiguration: true };
}

async function findBridgeConfiguration(environment = process.env) {
  const bridgeUrl = (environment.DIRGEST_BRIDGE_URL || DEFAULT_BRIDGE_URL).replace(/\/+$/, '');
  try {
    const health = await fetch(`${bridgeUrl}/healthz`, { signal: AbortSignal.timeout(500) });
    if (!health.ok) return null;
    const models = await fetch(`${bridgeUrl}/v1/models`, { signal: AbortSignal.timeout(1500) });
    if (!models.ok) return null;
    return resolveBridgeConfiguration(await models.json(), environment);
  } catch {
    return null;
  }
}

export function resolveModelConfiguration(hitch, environment = process.env) {
  const configuredProvider = hitch.providers.find((provider) => hasConfiguredCredential(provider, environment));
  const provider = environment.DIRGEST_PROVIDER || configuredProvider?.id || 'openai';
  const selectedProvider = hitch.providers.find((candidate) => candidate.id === provider);
  const model = environment.DIRGEST_MODEL || selectedProvider?.defaultModel || 'gpt-4o-mini';
  return { provider, model, usesModelHitchConfiguration: Boolean(configuredProvider && !environment.DIRGEST_PROVIDER) };
}

export async function getSuggestions(project, { mock = false, mode = 'balanced' } = {}) {
  if (!Object.hasOwn(MODE_INSTRUCTIONS, mode)) throw new Error(`Unknown suggestion mode: ${mode}.`);
  if (mock) return mockSuggestions(project, mode);
  const hitch = new ModelHitch();
  let configuration = resolveModelConfiguration(hitch);
  if (!configuration.usesModelHitchConfiguration && !process.env.DIRGEST_PROVIDER) configuration = await findBridgeConfiguration() || configuration;
  const { provider, model, usesModelHitchConfiguration, credentials } = configuration;
  if (provider === 'openai' && !process.env.OPENAI_API_KEY && !usesModelHitchConfiguration) throw new Error('No ModelHitch provider configuration was found. Set a supported provider API key, set DIRGEST_PROVIDER, or use --mock for offline mode.');
  try {
    const messages = [{ role: 'system', content: systemPrompt(mode) }, { role: 'user', content: `Project metadata:\n${JSON.stringify(project.metadata)}\n\nBounded project sample:\n${project.sample || '(No readable project files detected.)'}` }];
    const request = (requestMessages) => hitch.chat({ provider, model, messages: requestMessages, responseFormat: { type: 'json_schema', name: 'dirgest_suggestions', schema: FEATURE_SCHEMA, strict: true } }, credentials);
    const result = await request(messages);
    const content = result.message?.content;
    try {
      return validateSuggestions(parseContent(content));
    } catch (error) {
      if (!error.message.startsWith('Model response') && !error.message.startsWith('Model returned') && !error.message.startsWith('Suggestion ')) throw error;
      const corrected = await request([...messages, { role: 'assistant', content }, { role: 'user', content: `The previous JSON was rejected: ${error.message} Return a complete replacement JSON object that satisfies every requirement, especially 4 to 6 suggestions, exactly 3 or 4 words per title, and prompts of at least 80 characters.` }]);
      return validateSuggestions(parseContent(corrected.message?.content));
    }
  } catch (error) {
    if (error.message.startsWith('Model response') || error.message.startsWith('Model returned') || error.message.startsWith('Suggestion ')) throw error;
    throw new Error(`Could not generate suggestions with ${provider}: ${error.message}`);
  }
}