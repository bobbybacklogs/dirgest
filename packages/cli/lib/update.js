import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageMetadata = require('../package.json');
const REGISTRY_URL = `https://registry.npmjs.org/${packageMetadata.name}`;
const UPDATE_TIMEOUT_MS = 3_000;

function versionParts(version) {
  const match = String(version).trim().replace(/^v/, '').split('-')[0].match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

export function isNewerVersion(currentVersion, latestVersion) {
  const current = versionParts(currentVersion);
  const latest = versionParts(latestVersion);
  if (!current || !latest) return false;
  for (let index = 0; index < current.length; index += 1) {
    if (latest[index] !== current[index]) return latest[index] > current[index];
  }
  return false;
}

export async function getLatestVersion({ fetchImpl = globalThis.fetch, timeoutMs = UPDATE_TIMEOUT_MS } = {}) {
  if (typeof fetchImpl !== 'function') return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(REGISTRY_URL, { headers: { accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) return null;
    const metadata = await response.json();
    return typeof metadata?.['dist-tags']?.latest === 'string' ? metadata['dist-tags'].latest : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function promptForUpdate(input, output, latestVersion) {
  const interfaceInstance = readline.createInterface({ input, output });
  const answer = await new Promise((resolve) => interfaceInstance.question(`dirgest ${latestVersion} is available. Update and restart? [y/N] `, resolve));
  interfaceInstance.close();
  return /^y(?:es)?$/i.test(answer.trim());
}

/**
 * Build the spawn invocation for a global npm install.
 * Windows needs `shell: true` for `.cmd` shims; without it Node returns EINVAL and the update is a no-op.
 */
export function buildNpmInstallSpawn(version, { platform = process.platform } = {}) {
  const args = ['install', '--global', `${packageMetadata.name}@${version}`];
  if (platform === 'win32') {
    return { command: 'npm', args, options: { stdio: 'inherit', shell: true } };
  }
  return { command: 'npm', args, options: { stdio: 'inherit' } };
}

export function installAndRestart(version, { spawn = spawnSync, execPath = process.execPath, argv = process.argv.slice(1), env = process.env, platform = process.platform } = {}) {
  const { command, args, options } = buildNpmInstallSpawn(version, { platform });
  const installResult = spawn(command, args, { ...options, env });
  if (installResult.error || installResult.status !== 0) {
    return { restarted: false, status: installResult.status ?? 1, error: installResult.error };
  }
  const restartResult = spawn(execPath, argv, {
    stdio: 'inherit',
    env: { ...env, DIRGEST_SKIP_UPDATE_CHECK: '1' },
  });
  return { restarted: true, status: restartResult.status ?? 1 };
}

export async function maybeUpdate({ input = process.stdin, output = process.stdout, env = process.env, fetchImpl, prompt = promptForUpdate, update = installAndRestart } = {}) {
  if (env.DIRGEST_SKIP_UPDATE_CHECK === '1' || env.DIRGEST_UPDATE_CHECK === '0' || !input.isTTY || !output.isTTY) return null;
  const latestVersion = await getLatestVersion({ fetchImpl });
  if (!latestVersion || !isNewerVersion(packageMetadata.version, latestVersion)) return null;
  if (!(await prompt(input, output, latestVersion))) return null;
  return update(latestVersion);
}

export { REGISTRY_URL, UPDATE_TIMEOUT_MS };
