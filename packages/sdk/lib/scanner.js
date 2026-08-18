import { promises as fs } from 'node:fs';
import path from 'node:path';

const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'build', 'out', 'coverage', '.next', '.cache', 'vendor']);
const IGNORED_FILES = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb']);
const MAX_FILES = 24;
const MAX_FILE_BYTES = 48 * 1024;
const MAX_SAMPLE_CHARS = 12_000;
const CRAWL_MAX_FILES = 96;
const CRAWL_MAX_DISCOVERED_FILES = 2_000;
const CRAWL_MAX_SAMPLE_CHARS = 36_000;

const ENTRY_PATTERNS = /^(index|main|app|server|cli|bin)\.(js|ts|mjs|cjs|jsx|tsx|py|go|rs|rb|java|kt)$/;
const CONFIG_PATTERNS = /^(package\.json|tsconfig\.json|\.eslintrc|\.prettierrc|vite\.config|webpack\.config|rollup\.config|jest\.config|vitest\.config|turbo\.json|nx\.json|firebase\.json|apphosting\.yaml|docker-compose|Dockerfile|Makefile|Cargo\.toml|go\.mod|pyproject\.toml|requirements\.txt|composer\.json)(\.(js|ts|json|yaml|yml))?$/i;
const README_PATTERNS = /^readme(?:\.md)?$/i;
const SCHEMA_PATTERNS = /schema|migration|model/i;
const ROUTE_PATTERNS = /route|router|endpoint|handler|controller|api/i;
const TEST_PATTERNS = /\.(test|spec|e2e)\./;

function isSourceFile(name) {
  return /^(readme(?:\.md)?|package\.json|pyproject\.toml|cargo\.toml|go\.mod|composer\.json|requirements(?:\.txt)?|.*\.(?:js|mjs|cjs|ts|tsx|jsx|py|go|rs|java|kt|rb|php|vue|svelte|md|json|yaml|yml))$/i.test(name);
}

function isBinary(buffer) { return buffer.includes(0); }

function filePriority(relativePath) {
  const basename = path.basename(relativePath);
  if (ENTRY_PATTERNS.test(basename)) return 0;
  if (CONFIG_PATTERNS.test(basename) || README_PATTERNS.test(basename)) return 1;
  if (SCHEMA_PATTERNS.test(basename) && /\.(js|ts|py|go|rs|rb|java|kt|sql)$/.test(basename)) return 2;
  if (ROUTE_PATTERNS.test(relativePath) && /\.(js|ts|py|go|rs|rb|java|kt|vue|svelte)$/.test(basename)) return 3;
  if (TEST_PATTERNS.test(basename)) return 6;
  if (/^(lib|utils|helpers|common|shared)\//.test(relativePath) && /\.(js|ts|mjs|cjs)$/.test(basename)) return 5;
  return 4;
}

function sortByPriority(files) {
  return [...files].sort((left, right) => filePriority(left.path) - filePriority(right.path));
}

function detectLanguage(files) {
  const counts = {};
  for (const file of files) {
    const ext = path.extname(file.path).toLowerCase();
    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') counts.JavaScript = (counts.JavaScript || 0) + 1;
    else if (ext === '.ts' || ext === '.tsx') counts.TypeScript = (counts.TypeScript || 0) + 1;
    else if (ext === '.py') counts.Python = (counts.Python || 0) + 1;
    else if (ext === '.go') counts.Go = (counts.Go || 0) + 1;
    else if (ext === '.rs') counts.Rust = (counts.Rust || 0) + 1;
    else if (ext === '.rb') counts.Ruby = (counts.Ruby || 0) + 1;
    else if (ext === '.java') counts.Java = (counts.Java || 0) + 1;
    else if (ext === '.kt') counts.Kotlin = (counts.Kotlin || 0) + 1;
    else if (ext === '.vue') counts.Vue = (counts.Vue || 0) + 1;
    else if (ext === '.svelte') counts.Svelte = (counts.Svelte || 0) + 1;
    else if (ext === '.jsx') counts['React JSX'] = (counts['React JSX'] || 0) + 1;
  }
  if (!Object.keys(counts).length) return null;
  return Object.entries(counts).sort((left, right) => right[1] - left[1])[0][0];
}

function detectFramework(packageMetadata) {
  const allDeps = { ...packageMetadata?.dependencies, ...packageMetadata?.devDependencies };
  const names = Object.keys(allDeps || {});
  if (names.some((n) => n === 'next')) return 'Next.js';
  if (names.some((n) => n === 'nuxt')) return 'Nuxt';
  if (names.some((n) => n === '@angular/core')) return 'Angular';
  if (names.some((n) => n === 'svelte' || n === '@sveltejs/kit')) return 'SvelteKit';
  if (names.some((n) => n === 'vue' || n === '@vue/cli')) return 'Vue';
  if (names.some((n) => n === 'express' || n === 'fastify' || n === 'hono')) return 'Node.js API';
  if (names.some((n) => n === 'react')) return 'React';
  if (names.some((n) => n === 'flask' || n === 'django')) return 'Python';
  if (names.some((n) => n === 'gin' || n === 'echo')) return 'Go';
  return null;
}

function findEntryPoints(files) {
  return files.filter((file) => {
    const basename = path.basename(file.path);
    return ENTRY_PATTERNS.test(basename);
  }).map((file) => file.path);
}

function summarizeDependencies(packageMetadata) {
  const deps = Object.keys(packageMetadata?.dependencies || {});
  const devDeps = Object.keys(packageMetadata?.devDependencies || {});
  if (!deps.length && !devDeps.length) return null;

  const firebaseKeywords = ['firebase', 'firestore', 'firebase-admin', '@firebase', 'firebase-functions'];
  const awsKeywords = ['aws-sdk', '@aws-sdk', 'amazon', 'dynamodb', 's3', 'lambda'];
  const aiKeywords = ['openai', 'anthropic', '@google/generative-ai', 'langchain', 'llama', 'cohere'];

  const firebase = deps.filter((d) => firebaseKeywords.some((k) => d.includes(k)));
  const aws = deps.filter((d) => awsKeywords.some((k) => d.includes(k)));
  const ai = deps.filter((d) => aiKeywords.some((k) => d.includes(k)));

  const parts = [`${deps.length} runtime, ${devDeps.length} dev`];
  if (firebase.length) parts.push(`Firebase: ${firebase.join(', ')}`);
  if (aws.length) parts.push(`AWS: ${aws.join(', ')}`);
  if (ai.length) parts.push(`AI: ${ai.join(', ')}`);

  const key = deps.filter((d) => !firebase.includes(d) && !aws.includes(d) && !ai.includes(d))
    .slice(0, 8).join(', ');
  if (key) parts.push(`Key: ${key}`);

  return parts.join(' | ');
}

function categorizeDependencies(packageMetadata) {
  const deps = Object.keys(packageMetadata?.dependencies || {});
  const devDeps = Object.keys(packageMetadata?.devDependencies || {});
  const firebaseKeywords = ['firebase', 'firestore', 'firebase-admin', '@firebase', 'firebase-functions'];
  const awsKeywords = ['aws-sdk', '@aws-sdk', 'amazon', 'dynamodb', 's3', 'lambda'];
  const aiKeywords = ['openai', 'anthropic', '@google/generative-ai', 'langchain', 'llama', 'cohere'];
  return {
    runtime: deps,
    dev: devDeps,
    firebase: deps.filter((d) => firebaseKeywords.some((k) => d.includes(k))),
    aws: deps.filter((d) => awsKeywords.some((k) => d.includes(k))),
    ai: deps.filter((d) => aiKeywords.some((k) => d.includes(k))),
  };
}

function detectProjectType(packageMetadata, files) {
  const scripts = Object.keys(packageMetadata?.scripts || {});
  const name = packageMetadata?.name || '';
  const allDeps = { ...packageMetadata?.dependencies, ...packageMetadata?.devDependencies };
  const depNames = Object.keys(allDeps);

  if (depNames.some((d) => d === 'next' || d === 'nuxt' || d === '@sveltejs/kit')) return 'fullstack app';
  if (depNames.some((d) => d === 'react' || d === 'vue' || d === 'svelte' || d === '@angular/core')) return 'frontend app';
  if (depNames.some((d) => d === 'express' || d === 'fastify' || d === 'hono' || d === 'koa')) return 'API / backend service';
  if (depNames.some((d) => d === 'electron')) return 'desktop app';
  if (depNames.some((d) => d === 'react-native' || d === 'expo')) return 'mobile app';
  if (scripts.includes('build') && !scripts.includes('start') && !scripts.includes('dev')) return 'library / package';
  if (name.includes('cli') || scripts.some((s) => s === 'bin' || s.includes('cli'))) return 'CLI tool';
  return null;
}

function detectProjectSummary(files, packageMetadata) {
  const language = detectLanguage(files);
  const framework = detectFramework(packageMetadata);
  const projectType = detectProjectType(packageMetadata, files);
  const entryPoints = findEntryPoints(files);
  const depSummary = summarizeDependencies(packageMetadata);

  const parts = [];
  if (projectType) parts.push(`Type: ${projectType}`);
  if (language) parts.push(`Language: ${language}`);
  if (framework) parts.push(`Framework: ${framework}`);
  if (entryPoints.length) parts.push(`Entry points: ${entryPoints.join(', ')}`);
  if (depSummary) parts.push(`Dependencies: ${depSummary}`);
  if (!parts.length) return null;
  return parts.join('\n');
}

function getProjectName(directory, packageMetadata, readme) {
  if (typeof packageMetadata?.name === 'string' && packageMetadata.name.trim()) return packageMetadata.name.trim();
  const readmeTitle = readme?.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return readmeTitle || path.basename(directory);
}

function buildSample(sortedFiles, maxChars = MAX_SAMPLE_CHARS) {
  return sortedFiles.map((file) => `--- ${file.path} ---\n${file.content}`).join('\n').slice(0, maxChars);
}

function parsePackageMetadata(packageFileContent) {
  if (!packageFileContent) return undefined;
  try { return JSON.parse(packageFileContent); } catch { return undefined; }
}

// --- I/O layer (filesystem access) ---

async function readTextFile(filePath) {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_FILE_BYTES) return null;
  const content = await fs.readFile(filePath);
  return isBinary(content) ? null : content.toString('utf8');
}

async function collectFiles(directory, relativeDirectory = '', files = []) {
  if (files.length >= MAX_FILES) return files;
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (files.length >= MAX_FILES) break;
    if (entry.name.startsWith('.env') || IGNORED_FILES.has(entry.name)) continue;
    const relativePath = path.join(relativeDirectory, entry.name);
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) await collectFiles(fullPath, relativePath, files);
    } else if (entry.isFile() && isSourceFile(entry.name)) {
      const text = await readTextFile(fullPath);
      if (text !== null) files.push({ path: relativePath, content: text });
    }
  }
  return files;
}

async function collectCrawlCandidates(directory, relativeDirectory = '', candidates = []) {
  if (candidates.length >= CRAWL_MAX_DISCOVERED_FILES) return candidates;
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (candidates.length >= CRAWL_MAX_DISCOVERED_FILES) break;
    if (entry.name.startsWith('.env') || IGNORED_FILES.has(entry.name)) continue;
    const relativePath = path.join(relativeDirectory, entry.name);
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) await collectCrawlCandidates(fullPath, relativePath, candidates);
    } else if (entry.isFile() && isSourceFile(entry.name)) {
      candidates.push({ path: relativePath, fullPath });
    }
  }
  return candidates;
}

function selectCrawlCandidates(candidates) {
  const sorted = [...candidates].sort((left, right) => {
    const priorityDifference = filePriority(left.path) - filePriority(right.path);
    return priorityDifference || left.path.localeCompare(right.path);
  });
  const selected = [];
  const selectedPaths = new Set();
  const directories = new Set();

  // Give every directory one representative file before filling by architectural priority.
  for (const candidate of sorted) {
    const directory = path.dirname(candidate.path);
    if (directories.has(directory)) continue;
    selected.push(candidate);
    selectedPaths.add(candidate.path);
    directories.add(directory);
    if (selected.length >= CRAWL_MAX_FILES) return selected;
  }
  for (const candidate of sorted) {
    if (selectedPaths.has(candidate.path)) continue;
    selected.push(candidate);
    if (selected.length >= CRAWL_MAX_FILES) break;
  }
  return selected;
}

function buildProjectTree(candidates, truncated) {
  const lines = candidates.map((candidate) => candidate.path).sort((left, right) => left.localeCompare(right));
  if (truncated) lines.push(`... additional files omitted after ${CRAWL_MAX_DISCOVERED_FILES} files`);
  return lines.join('\n');
}

async function collectCrawlFiles(directory) {
  const candidates = await collectCrawlCandidates(directory);
  const selected = selectCrawlCandidates(candidates);
  const files = [];
  for (const candidate of selected) {
    const content = await readTextFile(candidate.fullPath);
    if (content !== null) files.push({ path: candidate.path, content });
  }
  return {
    files,
    tree: buildProjectTree(candidates, candidates.length >= CRAWL_MAX_DISCOVERED_FILES),
    discoveredFileCount: candidates.length,
  };
}

// --- Pure transform layer (no I/O) ---

export function buildProjectContext(directory, files, packageMetadata = undefined, { crawl = false, tree = '', discoveredFileCount = files.length } = {}) {
  const readme = files.find((file) => /^readme(?:\.md)?$/i.test(file.path))?.content;
  const dependencies = categorizeDependencies(packageMetadata);
  const sortedFiles = sortByPriority(files);
  const filesWithPriority = sortedFiles.map((file) => ({ path: file.path, content: file.content, priority: filePriority(file.path) }));
  return {
    directory: path.resolve(directory),
    name: getProjectName(directory, packageMetadata, readme),
    summary: detectProjectSummary(files, packageMetadata, dependencies),
    metadata: {
      packageName: packageMetadata?.name,
      description: packageMetadata?.description,
      scripts: Object.keys(packageMetadata?.scripts ?? {}),
      fileCount: files.length,
      discoveredFileCount,
    },
    sample: buildSample(sortedFiles, crawl ? CRAWL_MAX_SAMPLE_CHARS : MAX_SAMPLE_CHARS),
    crawl,
    tree,
    files: filesWithPriority,
    dependencies,
    entryPoints: findEntryPoints(files),
    detectedLanguage: detectLanguage(files),
    detectedFramework: detectFramework(packageMetadata),
    detectedProjectType: detectProjectType(packageMetadata, files),
  };
}

// --- Convenience: I/O + transform ---

export async function inspectProject(directory, { crawl = false } = {}) {
  let stat;
  try { stat = await fs.stat(directory); } catch { throw new Error(`Directory not found: ${directory}`); }
  if (!stat.isDirectory()) throw new Error(`Not a directory: ${directory}`);
  const crawlResult = crawl ? await collectCrawlFiles(directory) : null;
  const files = crawlResult?.files || await collectFiles(directory);
  const packageFile = files.find((file) => file.path === 'package.json');
  const packageMetadata = parsePackageMetadata(packageFile?.content);
  return buildProjectContext(directory, files, packageMetadata, {
    crawl,
    tree: crawlResult?.tree,
    discoveredFileCount: crawlResult?.discoveredFileCount,
  });
}

export { filePriority, sortByPriority, detectLanguage, detectFramework, findEntryPoints, summarizeDependencies, detectProjectType, detectProjectSummary, isSourceFile, MAX_FILES, MAX_FILE_BYTES, MAX_SAMPLE_CHARS, CRAWL_MAX_FILES, CRAWL_MAX_DISCOVERED_FILES, CRAWL_MAX_SAMPLE_CHARS, IGNORED_DIRECTORIES, IGNORED_FILES };
