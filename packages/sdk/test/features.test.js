import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MAX_FEATURES, MAX_FEATURE_FILE_BYTES, dedupeFeatures, parseFeatureFile, parseFeatureList, readFeatureFile, reviewFeatures, splitFeatureEntry, validateFeatureReview } from '@dirgest/sdk/lib/features.js';

const project = { name: 'dirgest', directory: os.tmpdir() };
const prompt = 'Implement this feature while preserving the existing architecture, adding meaningful validation, handling errors, and testing the finished user-facing workflow.';

let tempDir;
test.beforeEach(async () => { tempDir = await mkdtemp(path.join(os.tmpdir(), 'dirgest-features-')); });
test.afterEach(async () => { await rm(tempDir, { recursive: true, force: true }); });

test('parseFeatureFile extracts markdown list items and headings while ignoring prose and code', () => {
  const features = parseFeatureFile(['# Feature roadmap', '', 'This paragraph is context and should be ignored.', '', '- Add dark mode toggle', '* Implement Stripe billing', '1. Build a project health dashboard', '- [ ] Support offline caching', '', '```', '- Add a fake feature from a code fence', '```', '', '---'].join('\n'));
  assert.deepEqual(features, ['Feature roadmap', 'Add dark mode toggle', 'Implement Stripe billing', 'Build a project health dashboard', 'Support offline caching']);
});

test('parseFeatureFile falls back to plain lines for unstructured txt files', () => {
  const features = parseFeatureFile('Add dark mode toggle\nImplement Stripe billing\nshort\n\nAdd dark mode toggle\n');
  assert.deepEqual(features, ['Add dark mode toggle', 'Implement Stripe billing']);
});

test('parseFeatureFile strips inline markdown emphasis, links, and code spans', () => {
  assert.deepEqual(parseFeatureFile('- **Add dark mode** using `prefers-color-scheme`\n- [Billing docs](https://example.com) integration work'), ['Add dark mode using prefers-color-scheme', 'Billing docs integration work']);
});

test('splitFeatureEntry splits "Name - description" style entries and leaves plain text alone', () => {
  assert.deepEqual(splitFeatureEntry('Dark mode - respect prefers-color-scheme'), { name: 'Dark mode', description: 'respect prefers-color-scheme' });
  assert.deepEqual(splitFeatureEntry('Dark mode \u2013 respect prefers-color-scheme'), { name: 'Dark mode', description: 'respect prefers-color-scheme' });
  assert.deepEqual(splitFeatureEntry('Dark mode \u2014 respect prefers-color-scheme'), { name: 'Dark mode', description: 'respect prefers-color-scheme' });
  assert.deepEqual(splitFeatureEntry('Dark mode: respect prefers-color-scheme'), { name: 'Dark mode', description: 'respect prefers-color-scheme' });
  assert.deepEqual(splitFeatureEntry('Add dark mode toggle'), { name: 'Add dark mode toggle', description: '' });
  assert.deepEqual(splitFeatureEntry('Real-time collaboration'), { name: 'Real-time collaboration', description: '' });
});

test('parseFeatureFile normalizes "Name - desc" style entries to a consistent em-dash shape', () => {
  const features = parseFeatureFile(['* Dark mode - respect prefers-color-scheme', '1. Stripe billing: charge on upgrade', '- Offline cache \u2013 cache scanned projects locally', '- Add dark mode toggle'].join('\n'));
  assert.deepEqual(features, [
    'Dark mode \u2014 respect prefers-color-scheme',
    'Stripe billing \u2014 charge on upgrade',
    'Offline cache \u2014 cache scanned projects locally',
    'Add dark mode toggle'
  ]);
});

test('parseFeatureFile dedupes entries that only differ by separator style', () => {
  const features = parseFeatureFile('- Dark mode - respect prefers-color-scheme\n- Dark mode: respect prefers-color-scheme\n');
  assert.deepEqual(features, ['Dark mode \u2014 respect prefers-color-scheme']);
});

test('parseFeatureList enforces the empty and maximum feature limits', () => {
  assert.throws(() => parseFeatureList('\n\n', 'empty.md'), /No features were found in empty\.md/);
  const tooMany = Array.from({ length: MAX_FEATURES + 1 }, (_, index) => `- Add capability number ${index}`).join('\n');
  assert.throws(() => parseFeatureList(tooMany, 'big.md'), new RegExp(`contains ${MAX_FEATURES + 1} features; the limit is ${MAX_FEATURES}`));
});

test('readFeatureFile accepts .md and .txt and rejects other extensions', async () => {
  const markdown = path.join(tempDir, 'features.md');
  await writeFile(markdown, '- Add dark mode toggle\n- Implement Stripe billing\n');
  const result = await readFeatureFile(markdown);
  assert.equal(result.name, 'features.md');
  assert.deepEqual(result.features, ['Add dark mode toggle', 'Implement Stripe billing']);

  const other = path.join(tempDir, 'features.json');
  await writeFile(other, '[]');
  await assert.rejects(readFeatureFile(other), /must be \.txt or \.md/);
  await assert.rejects(readFeatureFile(path.join(tempDir, 'missing.md')), /Feature file not found/);
});

test('readFeatureFile rejects files above the size limit', async () => {
  const oversized = path.join(tempDir, 'oversized.txt');
  await writeFile(oversized, 'x'.repeat(MAX_FEATURE_FILE_BYTES + 1));
  await assert.rejects(readFeatureFile(oversized), /the feature file limit is 64 KB/);
});

test('validateFeatureReview normalizes entries and derives a title when the model omits one', () => {
  const features = ['Add dark mode toggle', 'Ship a physical hardware device'];
  const reviews = validateFeatureReview({ reviews: [
    { feature: 'Add dark mode toggle', fit: true, reasoning: 'Fits the existing web client.', prompt },
    { feature: 'Ship a physical hardware device', fit: false, reasoning: 'Out of scope for a CLI and web tool.', alternative: prompt }
  ] }, features);
  assert.deepEqual(reviews[0], { feature: features[0], fit: true, reasoning: 'Fits the existing web client.', title: 'Add Dark Mode Toggle', prompt });
  assert.deepEqual(reviews[1], { feature: features[1], fit: false, reasoning: 'Out of scope for a CLI and web tool.', alternative: prompt });
});

test('validateFeatureReview matches entries returned out of order and rejects incomplete ones', () => {
  const features = ['Add dark mode toggle', 'Implement Stripe billing'];
  const reviews = validateFeatureReview({ reviews: [
    { feature: 'Implement Stripe billing', fit: false, reasoning: 'No payment surface exists yet.', alternative: prompt },
    { feature: 'Add dark mode toggle', fit: true, title: 'Dark Mode Toggle', reasoning: 'Fits the existing web client.', prompt }
  ] }, features);
  assert.deepEqual(reviews.map((review) => review.feature), features);
  assert.equal(reviews[0].title, 'Dark Mode Toggle');
  assert.throws(() => validateFeatureReview({ reviews: [{ feature: features[0], fit: true, reasoning: 'Fits the existing web client.' }] }, [features[0]]), /must include a "prompt"/);
  assert.throws(() => validateFeatureReview({ reviews: [{ feature: features[0], fit: false, reasoning: 'Too short overall.' }] }, [features[0]]), /must include an "alternative"/);
  assert.throws(() => validateFeatureReview({ reviews: [] }, features), /at least one feature review/);
});

test('mock feature review splits fits from misfits and produces full coding prompts', async () => {
  const review = await reviewFeatures(project, ['Add dark mode toggle', 'A vague aspiration about the future'], { mock: true, source: 'features.md' });
  assert.equal(review.source, 'features.md');
  assert.deepEqual([review.total, review.fitCount, review.misfitCount], [2, 1, 1]);
  assert.equal(review.fits[0].feature, 'Add dark mode toggle');
  assert.ok(review.fits[0].prompt.length >= 80);
  assert.ok(review.fits[0].title.split(/\s+/).length >= 3);
  assert.equal(review.misfits[0].feature, 'A vague aspiration about the future');
  assert.ok(review.misfits[0].alternative.length >= 80);
});

test('dedupeFeatures trims, drops blanks, and collapses case/punctuation/whitespace variants', () => {
  assert.deepEqual(
    dedupeFeatures(['Add dark mode toggle', '  add dark mode toggle.  ', 'ADD DARK MODE TOGGLE', '', '   ', 'Implement Stripe billing', 'Implement   Stripe billing']),
    ['Add dark mode toggle', 'Implement Stripe billing']
  );
});

test('reviewFeatures dedupes the list before it is ever sent to the model', async () => {
  const review = await reviewFeatures(project, ['Add dark mode toggle', 'add dark mode toggle', 'Add dark mode toggle.', 'A vague aspiration about the future'], { mock: true, source: 'features.md' });
  assert.equal(review.total, 2);
  assert.equal(review.fits.length, 1);
  assert.equal(review.fits[0].feature, 'Add dark mode toggle');
  assert.equal(review.misfits.length, 1);
});

test('reviewFeatures rejects empty and oversized feature lists', async () => {
  await assert.rejects(reviewFeatures(project, [], { mock: true }), /At least one feature is required/);
  await assert.rejects(reviewFeatures(project, ['   ', ''], { mock: true }), /At least one feature is required/);
  await assert.rejects(reviewFeatures(project, Array.from({ length: MAX_FEATURES + 1 }, (_, index) => `Add capability ${index}`), { mock: true }), new RegExp(`the limit is ${MAX_FEATURES}`));
});
