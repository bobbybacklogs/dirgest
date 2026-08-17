import { promises as fs } from 'node:fs';
import path from 'node:path';

const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'build', 'out', 'coverage', '.next', '.cache', 'vendor']);
const IGNORED_FILES = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb']);
const MAX_FILES = 24;
const MAX_FILE_BYTES = 48 * 1024;
const MAX_SAMPLE_CHARS = 12_000;

function isSourceFile(name) {
  return /^(readme(?:\.md)?|package\.json|pyproject\.toml|cargo\.toml|go\.mod|composer\.json|requirements(?:\.txt)?|.*\.(?:js|mjs|cjs|ts|tsx|jsx|py|go|rs|java|kt|rb|php|vue|svelte|md|json|yaml|yml))$/i.test(name);
}

function isBinary(buffer) { return buffer.includes(0); }

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

function getProjectName(directory, packageMetadata, readme) {
  if (typeof packageMetadata?.name === 'string' && packageMetadata.name.trim()) return packageMetadata.name.trim();
  const readmeTitle = readme?.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return readmeTitle || path.basename(directory);
}

export async function inspectProject(directory) {
  let stat;
  try { stat = await fs.stat(directory); } catch { throw new Error(`Directory not found: ${directory}`); }
  if (!stat.isDirectory()) throw new Error(`Not a directory: ${directory}`);
  const files = await collectFiles(directory);
  const packageFile = files.find((file) => file.path === 'package.json');
  let packageMetadata;
  try { packageMetadata = packageFile ? JSON.parse(packageFile.content) : undefined; } catch { packageMetadata = undefined; }
  const readme = files.find((file) => /^readme(?:\.md)?$/i.test(file.path))?.content;
  const sample = files.map((file) => `--- ${file.path} ---\n${file.content}`).join('\n').slice(0, MAX_SAMPLE_CHARS);
  return { directory: path.resolve(directory), name: getProjectName(directory, packageMetadata, readme), metadata: { packageName: packageMetadata?.name, description: packageMetadata?.description, scripts: Object.keys(packageMetadata?.scripts ?? {}), fileCount: files.length }, sample };
}