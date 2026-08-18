import { randomUUID } from 'node:crypto';

export class JobStore {
  #jobs = new Map();

  create(task) {
    const id = randomUUID();
    const job = { id, status: 'pending', result: null, error: null, createdAt: Date.now() };
    this.#jobs.set(id, job);
    task().then((result) => {
      job.status = 'completed';
      job.result = result;
    }).catch((error) => {
      job.status = 'failed';
      job.error = { code: 'job-failed', message: error.message };
    });
    return { id, status: 'pending' };
  }

  get(jobId) {
    return this.#jobs.get(jobId) || null;
  }

  delete(jobId) {
    return this.#jobs.delete(jobId);
  }

  get size() {
    return this.#jobs.size;
  }

  clear() {
    this.#jobs.clear();
  }
}
