import assert from 'node:assert/strict';
import test from 'node:test';
import { attemptWithCandidateModels, bridgeModelCandidates, getAskResponse, getSuggestions, isRetryableModelError, resolveBridgeConfiguration, resolveModelConfiguration, validateAskResponse, validateSuggestions } from '@dirgest/sdk/lib/suggestions.js';
import { ModelHitchError } from 'modelhitch';
import { parseSelection } from '@dirgest/sdk/lib/selection-internal.js';

const prompt = 'Implement this feature while preserving the existing architecture, adding meaningful validation, handling errors, and testing the finished user-facing workflow.';
test('validateSuggestions accepts strict 3-4 word titles and complete prompts', () => { const suggestions = validateSuggestions({ suggestions: ['Project Health Summary', 'Guided First Run', 'Actionable Error Messages', 'Focused Test Coverage'].map((title) => ({ title, prompt: `${prompt} ${title}` })) }); assert.equal(suggestions.length, 4); });
test('validateSuggestions rejects invalid model output', () => { assert.throws(() => validateSuggestions({ suggestions: [{ title: 'Too Short', prompt }] }), /4 to 6/); assert.throws(() => validateSuggestions({ suggestions: Array.from({ length: 4 }, () => ({ title: 'Bad Title', prompt })) }), /3-4 words/); });
test('validateSuggestions rejects a prompt reused across different suggestions', () => {
  const titles = ['Project Health Summary', 'Guided First Run', 'Actionable Error Messages', 'Focused Test Coverage'];
  assert.throws(() => validateSuggestions({ suggestions: titles.map((title) => ({ title, prompt })) }), /reuses the same prompt/);
});
test('mock suggestions use strict 3-4 word titles for every mode', async () => { for (const mode of ['balanced', 'growth', 'ux', 'technical', 'wild']) { const suggestions = await getSuggestions({ name: 'dirgest' }, { mock: true, mode }); assert.equal(suggestions.length, 5); for (const suggestion of suggestions) assert.ok(suggestion.title.split(/\s+/).length >= 3 && suggestion.title.split(/\s+/).length <= 4, `${mode}: ${suggestion.title}`); } });
test('suggestion modes produce distinct deterministic ideas', async () => { const project = { name: 'dirgest' }; const balanced = await getSuggestions(project, { mock: true }); const growth = await getSuggestions(project, { mock: true, mode: 'growth' }); assert.notDeepEqual(growth, balanced); await assert.rejects(getSuggestions(project, { mock: true, mode: 'invalid' }), /Unknown suggestion mode/); });
test('ModelHitch credential configuration is preferred over the default provider', () => { const hitch = { providers: [{ id: 'openai', defaultModel: 'gpt-4o-mini', apiKeyEnvVar: 'OPENAI_API_KEY' }, { id: 'groq', defaultModel: 'llama-3.3-70b-versatile', apiKeyEnvVar: 'GROQ_API_KEY' }] }; assert.deepEqual(resolveModelConfiguration(hitch, { GROQ_API_KEY: 'configured-key' }), { provider: 'groq', model: 'llama-3.3-70b-versatile', usesModelHitchConfiguration: true }); });
test('dirgest model overrides win and no ModelHitch configuration preserves OpenAI defaults', () => { const hitch = { providers: [{ id: 'openai', defaultModel: 'gpt-4o-mini', apiKeyEnvVar: 'OPENAI_API_KEY' }, { id: 'groq', defaultModel: 'llama-3.3-70b-versatile', apiKeyEnvVar: 'GROQ_API_KEY' }] }; assert.deepEqual(resolveModelConfiguration(hitch, {}), { provider: 'openai', model: 'gpt-4o-mini', usesModelHitchConfiguration: false }); assert.deepEqual(resolveModelConfiguration(hitch, { GROQ_API_KEY: 'configured-key', DIRGEST_PROVIDER: 'openai', DIRGEST_MODEL: 'gpt-4.1-mini' }), { provider: 'openai', model: 'gpt-4.1-mini', usesModelHitchConfiguration: false }); });
test('bridge model configuration gives the global override precedence', () => { const catalog = { data: [{ id: 'other-model' }, { id: 'big-pickle' }] }; assert.equal(resolveBridgeConfiguration(catalog, { DIRGEST_MODEL: 'explicit-model', DIRGEST_BRIDGE_MODEL: 'bridge-model' }).model, 'explicit-model'); assert.equal(resolveBridgeConfiguration(catalog, { DIRGEST_BRIDGE_MODEL: 'bridge-model' }).model, 'bridge-model'); assert.deepEqual(resolveBridgeConfiguration(catalog, {}), { provider: 'openai', model: 'big-pickle', credentials: { apiKey: 'sk-bridge-local', baseUrl: 'http://127.0.0.1:3939/v1' }, usesModelHitchConfiguration: true }); assert.equal(resolveBridgeConfiguration({ data: [] }, {}), null); });
test('bridge model preference picks a reliable model before the rate-limited free-tier default', () => {
  const catalog = { data: [{ id: 'big-pickle' }, { id: 'deepseek-v4-flash' }, { id: 'gpt-5.6-luna' }] };
  assert.deepEqual(resolveBridgeConfiguration(catalog, {}), { provider: 'openai', model: 'deepseek-v4-flash', credentials: { apiKey: 'sk-bridge-local', baseUrl: 'http://127.0.0.1:3939/v1' }, usesModelHitchConfiguration: true });
  assert.equal(resolveBridgeConfiguration({ data: [{ id: 'only-random-model' }] }, {}).model, 'only-random-model');
});
test('resolveModelConfiguration avoids the rate-limited free-tier default for opencode-zen', () => {
  const hitch = {
    providers: [
      { id: 'opencode-zen', defaultModel: 'big-pickle', apiKeyEnvVar: 'OPENCODE_ZEN_API_KEY' },
      { id: 'openai', defaultModel: 'gpt-4o-mini', apiKeyEnvVar: 'OPENAI_API_KEY' }
    ]
  };
  assert.deepEqual(resolveModelConfiguration(hitch, { OPENCODE_ZEN_API_KEY: 'configured-key' }), { provider: 'opencode-zen', model: 'deepseek-v4-flash', usesModelHitchConfiguration: true });
  assert.deepEqual(resolveModelConfiguration(hitch, { OPENAI_API_KEY: 'configured-key' }), { provider: 'openai', model: 'gpt-4o-mini', usesModelHitchConfiguration: true });
  assert.deepEqual(resolveModelConfiguration(hitch, { OPENCODE_ZEN_API_KEY: 'configured-key', DIRGEST_MODEL: 'explicit-model' }), { provider: 'opencode-zen', model: 'explicit-model', usesModelHitchConfiguration: true });
});
test('bridgeModelCandidates returns ordered preferences and falls back to the first advertised model', () => {
  const catalog = { data: [{ id: 'random-1' }, { id: 'gpt-5.4-nano' }, { id: 'gpt-5.6-luna' }] };
  assert.deepEqual(bridgeModelCandidates(catalog), ['gpt-5.6-luna', 'gpt-5.4-nano']);
  assert.deepEqual(bridgeModelCandidates({ data: [{ id: 'only-model' }] }), ['only-model']);
  assert.deepEqual(bridgeModelCandidates({ data: [] }), []);
});
test('model fallback advances on retryable errors and uses the first succeeding candidate', async () => {
  const calls = [];
  const { model, result } = await attemptWithCandidateModels(async (candidateModel) => {
    calls.push(candidateModel);
    if (candidateModel === 'deepseek-v4-flash') throw new ModelHitchError('rate-limited', 'Provider "opencode-zen" rate limited the request.', { providerId: 'opencode-zen' });
    return { ok: true, model: candidateModel };
  }, ['deepseek-v4-flash', 'gpt-5.6-luna']);
  assert.deepEqual({ model, result }, { model: 'gpt-5.6-luna', result: { ok: true, model: 'gpt-5.6-luna' } });
  assert.deepEqual(calls, ['deepseek-v4-flash', 'gpt-5.6-luna']);
});
test('model fallback throws the last retryable error when every candidate fails', async () => {
  await assert.rejects(attemptWithCandidateModels(async () => { throw new ModelHitchError('provider-error', 'Upstream request failed: Endpoint is unavailable.', { providerId: 'opencode-zen', status: 503 }); }, ['deepseek-v4-flash', 'gpt-5.6-luna']), (error) => error.code === 'provider-error' && error.message.includes('Endpoint is unavailable'));
});
test('model fallback does not swallow non-retryable errors', async () => {
  await assert.rejects(attemptWithCandidateModels(async () => { throw new ModelHitchError('model-not-found', 'No such model.', { providerId: 'opencode-zen' }); }, ['first', 'second']), (error) => error.code === 'model-not-found');
});
test('retryable detection maps rate limits and upstream 5xx responses', () => {
  assert.equal(isRetryableModelError(new ModelHitchError('rate-limited', 'x')), true);
  assert.equal(isRetryableModelError(new ModelHitchError('provider-error', 'x', { status: 503 })), true);
  assert.equal(isRetryableModelError(new ModelHitchError('bad-request', 'x', { status: 429 })), true);
  assert.equal(isRetryableModelError(new ModelHitchError('model-not-found', 'x')), false);
  assert.equal(isRetryableModelError(new Error('plain')), false);
});
test('parseSelection handles prompt, all, and quit choices', () => { assert.equal(parseSelection('2', 5), 1); assert.equal(parseSelection('a', 5), 'all'); assert.equal(parseSelection('q', 5), 'quit'); assert.equal(parseSelection('9', 5), null); });

test('validateAskResponse accepts a valid fit response', () => {
  const result = validateAskResponse({ fit: true, reasoning: 'This feature aligns well with the project.', prompt: 'Implement a dark mode toggle for the application. Start by reviewing the existing theme system and CSS variables.' });
  assert.equal(result.fit, true);
  assert.equal(result.reasoning, 'This feature aligns well with the project.');
  assert.ok(result.prompt.length >= 80);
});

test('validateAskResponse accepts a valid no-fit response', () => {
  const result = validateAskResponse({ fit: false, reasoning: 'A dark mode toggle is a solid idea, but this project is a CLI tool.', alternative: 'Implement color theme configuration for terminal output that supports multiple palettes and respects user preferences stored in a config file.' });
  assert.equal(result.fit, false);
  assert.ok(result.reasoning.length >= 10);
  assert.ok(result.alternative.length >= 80);
});

test('validateAskResponse rejects missing fit field', () => {
  assert.throws(() => validateAskResponse({ reasoning: 'test' }), /boolean "fit"/);
});

test('validateAskResponse rejects short reasoning', () => {
  assert.throws(() => validateAskResponse({ fit: true, reasoning: 'short', prompt: 'x'.repeat(80) }), /reasoning/);
});

test('validateAskResponse rejects fit=true without prompt', () => {
  assert.throws(() => validateAskResponse({ fit: true, reasoning: 'This feature aligns well with the project.' }), /prompt/);
});

test('validateAskResponse rejects fit=true with short prompt', () => {
  assert.throws(() => validateAskResponse({ fit: true, reasoning: 'This feature aligns well with the project.', prompt: 'too short' }), /prompt/);
});

test('validateAskResponse rejects fit=false without alternative', () => {
  assert.throws(() => validateAskResponse({ fit: false, reasoning: 'Not a good fit for this project.' }), /alternative/);
});

test('validateAskResponse rejects fit=false with short alternative', () => {
  assert.throws(() => validateAskResponse({ fit: false, reasoning: 'Not a good fit for this project.', alternative: 'too short' }), /alternative/);
});

test('getAskResponse with mock returns fit for action-oriented questions', async () => {
  const result = await getAskResponse({ name: 'test-project' }, 'add dark mode toggle', { mock: true });
  assert.equal(result.fit, true);
  assert.ok(result.prompt.length >= 80);
});

test('getAskResponse with mock returns no-fit for abstract questions', async () => {
  const result = await getAskResponse({ name: 'test-project' }, 'philosophical meaning of code', { mock: true });
  assert.equal(result.fit, false);
  assert.ok(result.alternative.length >= 80);
});