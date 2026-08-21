import { promises as fs } from 'node:fs';
import path from 'node:path';
import { attemptWithCandidateModels, buildCorrectionMessages, createModelSession } from './suggestions.js';
import { readHistory, formatHistoryForPrompt } from './history.js';

export const FEATURE_FILE_EXTENSIONS = ['.txt', '.md'];
export const MAX_FEATURE_FILE_BYTES = 64 * 1024;
export const MAX_FEATURES = 40;
export const MIN_FEATURE_LENGTH = 8;
export const MAX_FEATURE_LENGTH = 400;
const REVIEW_BATCH_SIZE = 10;

const FENCE = /^\s*(```|~~~)/;
const HORIZONTAL_RULE = /^\s*([-*_])\s*(\1\s*){2,}$/;
const TABLE_ROW = /^\s*\|/;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;
const HEADING_MARKER = /^\s*#{1,6}\s+/;
const CHECKBOX = /^\[[ xX]\]\s*/;
const ACTION_VERB = /\b(add|implement|create|build|fix|improve|enhance|update|refactor|support|introduce|enable)\b/;
const NAME_DESCRIPTION_SEPARATOR = /^(.{2,80}?)(?:\s+[-\u2013\u2014]\s+|:\s+)(\S.{2,})$/;

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reviews'],
  properties: {
    reviews: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['feature', 'fit', 'reasoning'],
        properties: {
          feature: { type: 'string', minLength: 3 },
          title: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9 &/-]{2,59}$' },
          fit: { type: 'boolean' },
          reasoning: { type: 'string', minLength: 10, maxLength: 500 },
          prompt: { type: 'string', minLength: 80 },
          alternative: { type: 'string', minLength: 80 }
        }
      }
    }
  }
};

function stripInlineMarkdown(line) {
  return line
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\*([^*]+)\*$/, '$1')
    .trim();
}

function normalizeFeature(text) {
  return text.trim().toLowerCase().replace(/[\s.:;,]+$/g, '').replace(/\s+/g, ' ');
}

/**
 * Trim and de-duplicate a feature list (case/whitespace/trailing-punctuation insensitive),
 * keeping the first occurrence of each. Runs before any model call so duplicate entries from
 * a caller-supplied `features` array are never sent to or scored by the model twice.
 */
export function dedupeFeatures(features) {
  const seen = new Set();
  const deduped = [];
  for (const raw of features) {
    const feature = String(raw ?? '').trim();
    if (!feature) continue;
    const key = normalizeFeature(feature);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(feature);
  }
  return deduped;
}

/**
 * Split a "Name - description", "Name: description", or em/en-dash variant into its parts.
 * Returns the original text as `name` with an empty `description` when no separator is found.
 */
export function splitFeatureEntry(text) {
  const match = text.match(NAME_DESCRIPTION_SEPARATOR);
  if (!match) return { name: text.trim(), description: '' };
  return { name: match[1].trim(), description: match[2].trim() };
}

/**
 * Normalize a raw feature line into a single canonical "Name \u2014 description" shape so mixed
 * separator styles ("-", ":", "\u2013", "\u2014") in the same file read as one consistent format.
 */
function normalizeFeatureText(text) {
  const { name, description } = splitFeatureEntry(text);
  return description ? `${name} \u2014 ${description}` : name;
}

/**
 * Extract one feature per line item from a `.md` or `.txt` document. When the document uses
 * headings or list markers, only those lines are treated as features so surrounding prose is ignored.
 */
export function parseFeatureFile(content) {
  if (typeof content !== 'string') throw new Error('Feature file content must be a string.');
  const rawLines = content.split(/\r?\n/);
  const candidates = [];
  let insideFence = false;
  let sawMarker = false;

  for (const rawLine of rawLines) {
    if (FENCE.test(rawLine)) { insideFence = !insideFence; continue; }
    if (insideFence) continue;
    const line = rawLine.trim();
    if (!line || HORIZONTAL_RULE.test(line) || TABLE_ROW.test(line) || line.startsWith('<!--')) continue;
    const isMarked = LIST_MARKER.test(rawLine) || HEADING_MARKER.test(rawLine);
    if (isMarked) sawMarker = true;
    const text = stripInlineMarkdown(line.replace(HEADING_MARKER, '').replace(LIST_MARKER, '').replace(CHECKBOX, ''));
    if (text) candidates.push({ text, isMarked });
  }

  const selected = sawMarker ? candidates.filter((candidate) => candidate.isMarked) : candidates;
  const seen = new Set();
  const features = [];
  for (const { text } of selected) {
    if (text.length < MIN_FEATURE_LENGTH) continue;
    const normalized = normalizeFeatureText(text);
    const key = normalizeFeature(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    features.push(normalized.length > MAX_FEATURE_LENGTH ? `${normalized.slice(0, MAX_FEATURE_LENGTH - 1).trimEnd()}\u2026` : normalized);
  }
  return features;
}

/**
 * Read and validate a feature list file. Only `.txt` and `.md` files under
 * {@link MAX_FEATURE_FILE_BYTES} with at most {@link MAX_FEATURES} entries are accepted.
 */
export async function readFeatureFile(filePath) {
  if (!filePath || typeof filePath !== 'string') throw new Error('A feature file path is required.');
  const resolved = path.resolve(filePath);
  const name = path.basename(resolved);
  const extension = path.extname(resolved).toLowerCase();
  if (!FEATURE_FILE_EXTENSIONS.includes(extension)) {
    throw new Error(`Feature files must be ${FEATURE_FILE_EXTENSIONS.join(' or ')}; received "${extension || name}".`);
  }
  let stats;
  try {
    stats = await fs.stat(resolved);
  } catch {
    throw new Error(`Feature file not found: ${resolved}`);
  }
  if (!stats.isFile()) throw new Error(`Not a file: ${resolved}`);
  if (stats.size > MAX_FEATURE_FILE_BYTES) {
    throw new Error(`${name} is ${Math.ceil(stats.size / 1024)} KB; the feature file limit is ${MAX_FEATURE_FILE_BYTES / 1024} KB.`);
  }
  const content = await fs.readFile(resolved, 'utf8');
  return { path: resolved, name, content, features: parseFeatureList(content, name) };
}

/**
 * Parse feature file content and enforce the count limits, reporting errors against `name`.
 */
export function parseFeatureList(content, name = 'feature file') {
  const features = parseFeatureFile(content);
  if (features.length === 0) throw new Error(`No features were found in ${name}. Use one feature per line or list item.`);
  if (features.length > MAX_FEATURES) throw new Error(`${name} contains ${features.length} features; the limit is ${MAX_FEATURES}.`);
  return features;
}

function reviewSystemPrompt() {
  return `You are a senior product engineer reviewing a proposed feature list against a real project's codebase. The input includes a project analysis summary, the project's directory layout, and a broad sample of its source files.

Before judging anything, determine (1) what the project actually is, (2) its stack, architecture, and conventions, and (3) what it is not — do not confuse individual dependencies with the project's identity.

Return one review entry for EVERY feature you are given, in the same order, with:
- feature: the feature text exactly as supplied.
- fit: true only if the feature genuinely belongs in this project's architecture, stack, and purpose.
- reasoning: 1-2 sentences. When fit is false, acknowledge the idea may be good in general and explain the specific mismatch with this codebase.
- title: required when fit is true. Exactly 3 or 4 words naming the feature.
- prompt: required when fit is true. A complete, actionable coding prompt of at least 80 characters covering scope, the relevant existing context in this codebase, expected behavior, edge cases, and validation.
- alternative: required when fit is false. A different feature prompt of at least 80 characters that would fit this project better.

Be honest and discriminating; do not force a fit and do not claim integrations or persistence that are absent from the context. Return only JSON matching the schema.`;
}

function buildReviewMessages(project, features, historyContext) {
  const summaryBlock = project.summary ? `\n\nProject analysis:\n${project.summary}` : '';
  const treeBlock = project.crawl && project.tree ? `\n\nFull project layout from crawl:\n${project.tree}` : '';
  const list = features.map((feature, index) => `${index + 1}. ${feature}`).join('\n');
  return [
    { role: 'system', content: reviewSystemPrompt() },
    { role: 'user', content: `Project metadata:\n${JSON.stringify(project.metadata)}${summaryBlock}${treeBlock}\n\n${project.crawl ? 'Broad cross-directory project sample' : 'Bounded project sample'}:\n${project.sample || '(No readable project files detected.)'}${historyContext}\n\nProposed features (${features.length}):\n${list}` }
  ];
}

function deriveTitle(feature) {
  const words = feature.split(/\s+/).map((word) => word.replace(/[^A-Za-z0-9&/]/g, '')).filter(Boolean).slice(0, 4);
  const title = words.map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
  return /^[A-Za-z0-9][A-Za-z0-9 &/-]{2,59}$/.test(title) ? title : 'Proposed Feature Change';
}

function mockPromptOpening(feature) {
  const text = feature.trim().replace(/[.]+$/, '');
  if (ACTION_VERB.test(text.split(/\s+/)[0].toLowerCase())) return text[0].toUpperCase() + text.slice(1);
  return `Implement support for ${text[0].toLowerCase() + text.slice(1)}`;
}

/**
 * Normalize a model payload into `{ feature, fit, reasoning, title?, prompt?, alternative? }` entries
 * aligned to the supplied feature list. Throws so callers can retry on an incomplete response.
 */
export function validateFeatureReview(payload, features) {
  const reviews = payload?.reviews;
  if (!Array.isArray(reviews) || reviews.length === 0) throw new Error('Review response must contain at least one feature review.');
  const byFeature = new Map(reviews.map((review) => [normalizeFeature(String(review?.feature ?? '')), review]));

  return features.map((feature, index) => {
    const review = byFeature.get(normalizeFeature(feature)) ?? reviews[index];
    if (!review) throw new Error(`Review response is missing an entry for feature ${index + 1}.`);
    if (typeof review.fit !== 'boolean') throw new Error(`Review response for feature ${index + 1} must include a boolean "fit" field.`);
    const reasoning = typeof review.reasoning === 'string' ? review.reasoning.trim() : '';
    if (reasoning.length < 10) throw new Error(`Review response for feature ${index + 1} must include a "reasoning" string with at least 10 characters.`);
    if (review.fit) {
      const prompt = typeof review.prompt === 'string' ? review.prompt.trim() : '';
      if (prompt.length < 80) throw new Error(`Review response for feature ${index + 1} must include a "prompt" with at least 80 characters.`);
      const title = typeof review.title === 'string' ? review.title.trim() : '';
      const wordCount = title ? title.split(/\s+/).length : 0;
      const usableTitle = wordCount >= 3 && wordCount <= 4 && /^[A-Za-z0-9][A-Za-z0-9 &/-]{2,59}$/.test(title) ? title : deriveTitle(feature);
      return { feature, fit: true, reasoning, title: usableTitle, prompt };
    }
    const alternative = typeof review.alternative === 'string' ? review.alternative.trim() : '';
    if (alternative.length < 80) throw new Error(`Review response for feature ${index + 1} must include an "alternative" with at least 80 characters.`);
    return { feature, fit: false, reasoning, alternative };
  });
}

function mockFeatureReview(project, features) {
  return features.map((feature) => {
    if (ACTION_VERB.test(feature.toLowerCase())) {
      return {
        feature,
        fit: true,
        reasoning: `This feature aligns with ${project.name}'s existing architecture and tech stack.`,
        title: deriveTitle(feature),
        prompt: `${mockPromptOpening(feature)} for ${project.name}. Start by reviewing the existing project context and preserve its established structure and conventions. Deliver a complete user-facing workflow with clear empty, loading, validation, success, and error states where relevant. Keep the change scoped, avoid inventing external integrations or persistence, add focused tests for the new behavior, and run the repository's relevant checks.`
      };
    }
    return {
      feature,
      fit: false,
      reasoning: `"${feature.trim()}" is a reasonable idea in general, but it does not match ${project.name}'s current architecture or purpose.`,
      alternative: `Implement a project health summary for ${project.name} that surfaces key metrics, recent changes, and actionable insights based on the existing codebase structure and conventions.`
    };
  });
}

function chunk(items, size) {
  const batches = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}

function summarize(reviews, source) {
  const fits = reviews.filter((review) => review.fit).map(({ feature, title, reasoning, prompt }) => ({ feature, title, reasoning, prompt }));
  const misfits = reviews.filter((review) => !review.fit).map(({ feature, reasoning, alternative }) => ({ feature, reasoning, alternative }));
  return { source, total: reviews.length, fitCount: fits.length, misfitCount: misfits.length, fits, misfits };
}

/**
 * Evaluate every feature in a parsed feature list against the project context and split the
 * results into good fits (with full coding prompts) and misfits (with reasons and alternatives).
 */
export async function reviewFeatures(project, features, { mock = false, environment = process.env, source } = {}) {
  if (!Array.isArray(features) || features.length === 0) throw new Error('At least one feature is required.');
  const deduped = dedupeFeatures(features);
  if (deduped.length === 0) throw new Error('At least one feature is required.');
  if (deduped.length > MAX_FEATURES) throw new Error(`Received ${deduped.length} features; the limit is ${MAX_FEATURES}.`);
  if (mock) return summarize(mockFeatureReview(project, deduped), source);

  const history = await readHistory(project.directory);
  const historyContext = formatHistoryForPrompt(history);
  const { hitch, configuration, candidates } = await createModelSession(environment);
  const { provider, credentials } = configuration;

  try {
    const reviews = [];
    let preferredModel;
    for (const batch of chunk(deduped, REVIEW_BATCH_SIZE)) {
      const messages = buildReviewMessages(project, batch, historyContext);
      const task = (candidateModel, extraMessages = []) => hitch.chat({ provider, model: candidateModel, messages: [...messages, ...extraMessages], responseFormat: { type: 'json_schema', name: 'dirgest_feature_review', schema: REVIEW_SCHEMA, strict: true } }, credentials);
      const batchCandidates = preferredModel ? [preferredModel, ...candidates.filter((candidate) => candidate !== preferredModel)] : candidates;
      const { model: successfulModel, result } = await attemptWithCandidateModels(task, batchCandidates);
      preferredModel = successfulModel;
      const content = result.message?.content;
      try {
        reviews.push(...validateFeatureReview(parseReviewContent(content), batch));
      } catch (error) {
        if (!error.message.startsWith('Review response') && !error.message.startsWith('Model returned')) throw error;
        const corrected = await task(successfulModel, buildCorrectionMessages(content, error));
        reviews.push(...validateFeatureReview(parseReviewContent(corrected.message?.content), batch));
      }
    }
    return summarize(reviews, source);
  } catch (error) {
    if (error.message.startsWith('Review response') || error.message.startsWith('Model returned')) throw error;
    if (credentials?.baseUrl) throw new Error(`Could not review features via the ModelHitch bridge${error.providerId ? ` with provider ${error.providerId}` : ''}: ${error.message}`);
    throw new Error(`Could not review features with ${provider}: ${error.message}`);
  }
}

function parseReviewContent(content) {
  if (typeof content !== 'string') throw new Error('Model returned no text content.');
  try { return JSON.parse(content); } catch { throw new Error('Model returned invalid JSON; try again or use --mock.'); }
}
