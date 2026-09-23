import assert from 'node:assert/strict';
import test from 'node:test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_RECOMMENDATION_COUNT,
  getRecommendations,
  normalizeRecommendationCount,
  validateRecommendations,
} from '@dirgest/sdk/lib/recommendations.js';
import { SUGGESTION_MODES } from '@dirgest/sdk/lib/suggestions.js';
import { excludeHistoryEntry, writeHistory } from '@dirgest/sdk/lib/history.js';

const prompt = 'Implement this feature while preserving the existing architecture, adding meaningful validation, handling errors, and testing the finished user-facing workflow.';

test('normalizeRecommendationCount accepts 5-20 and defaults to 10', () => {
  assert.equal(normalizeRecommendationCount(undefined), DEFAULT_RECOMMENDATION_COUNT);
  assert.equal(normalizeRecommendationCount('12'), 12);
  assert.throws(() => normalizeRecommendationCount(4), /5 to 20/);
  assert.throws(() => normalizeRecommendationCount(21), /5 to 20/);
});

test('validateRecommendations requires exact count and valid modes', () => {
  const recommendations = SUGGESTION_MODES.slice(0, 5).map((mode, index) => ({
    mode,
    title: `Feature Idea ${index + 1}`,
    prompt: `${prompt} Feature Idea ${index + 1}`,
  }));
  assert.equal(validateRecommendations({ recommendations }, 5).length, 5);
  assert.throws(() => validateRecommendations({ recommendations: recommendations.slice(0, 4) }, 5), /exactly 5/);
  assert.throws(
    () => validateRecommendations({ recommendations: [{ mode: 'invalid', title: 'Bad Mode Title', prompt }] }, 1),
    /invalid mode/,
  );
});

test('mock recommendations interleave ideas from every suggestion category', async () => {
  const recommendations = await getRecommendations({ name: 'dirgest' }, { mock: true, count: 10 });
  assert.equal(recommendations.length, 10);
  const modes = new Set(recommendations.map((recommendation) => recommendation.mode));
  assert.ok(modes.has('balanced'));
  assert.ok(modes.has('ai'));
  assert.ok(modes.has('ai-wild'));
  for (const recommendation of recommendations) {
    assert.ok(SUGGESTION_MODES.includes(recommendation.mode));
    assert.ok(recommendation.title.split(/\s+/).length >= 3);
    assert.ok(recommendation.prompt.length >= 80);
  }
});

test('mock recommendations omit titles already excluded in project history', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dirgest-recommend-'));
  await writeHistory(directory, excludeHistoryEntry('balanced', 'Project Health Summary'));
  const recommendations = await getRecommendations({ name: 'dirgest', directory }, { mock: true, count: 10 });
  assert.equal(recommendations.some((recommendation) => recommendation.title === 'Project Health Summary'), false);
  await fs.rm(directory, { recursive: true, force: true });
});
