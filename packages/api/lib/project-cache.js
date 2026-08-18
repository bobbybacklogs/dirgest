import { createHash } from 'node:crypto';

export class ProjectCache {
  #cache = new Map();

  createId(files) {
    const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
    const payload = sorted.map((f) => `${f.path}:${f.content.length}`).join('\n');
    return createHash('sha256').update(payload).digest('hex').slice(0, 16);
  }

  get(projectId) {
    return this.#cache.get(projectId) || null;
  }

  set(projectId, context) {
    this.#cache.set(projectId, context);
  }

  has(projectId) {
    return this.#cache.has(projectId);
  }

  delete(projectId) {
    return this.#cache.delete(projectId);
  }

  get size() {
    return this.#cache.size;
  }

  clear() {
    this.#cache.clear();
  }
}
