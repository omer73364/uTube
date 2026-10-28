import { randomUUID } from 'node:crypto';
import { createProgressFilter } from '../../../../packages/core/progress.js';

// Sequential by default: avoid overwhelming YouTube or running several encoders.
export class DownloadQueue {
  #jobs = [];
  #active;
  #closed = false;
  #paused = false;
  #availability = () => undefined;
  #idle = Promise.resolve();
  /** @param {(job: any, options: any) => Promise<any>} run
   * @param {(jobs: any[]) => void} [notify] */
  constructor(run, notify = () => {}) { this.run = run; this.notify = notify; }
  snapshot() { return this.#jobs.map(({ controller, ...job }) => ({ ...job, holdReason: job.status === 'queued' ? (this.#paused ? 'update' : this.#availability(job.videoId)) : undefined })); }
  #emit() { this.notify(this.snapshot()); }
  restore(jobs) {
    if (this.#jobs.length || this.#active || this.#closed) throw new Error('History can only be restored to a new queue.');
    this.#jobs = jobs.map((job) => ['queued', 'running', 'cancelling'].includes(job.status)
      ? { ...job, status: 'cancelled', interrupted: true, loaded: 0, total: undefined, stage: undefined, speed: undefined, eta: undefined }
      : { ...job, loaded: 0 });
    this.#emit();
  }
  setAvailability(check) { this.#availability = check; this.#emit(); this.#pump(); }
  pause() { this.#paused = true; this.#emit(); }
  resume() { this.#paused = false; this.#emit(); this.#pump(); }
  async prepareUpdate(interrupt = false) {
    this.pause();
    if (interrupt && this.#active) { this.#active.interrupted = true; this.cancel(this.#active.id); }
    await this.#idle;
  }
  add(items) {
    if (this.#closed) throw new Error('The download queue is shutting down.');
    if (this.#jobs.filter((job) => ['queued', 'running', 'cancelling'].includes(job.status)).length + items.length > 500) throw new Error('The queue is limited to 500 unfinished downloads.');
    const jobs = items.map((item) => ({ ...item, id: randomUUID(), status: 'queued', loaded: 0, createdAt: Date.now() }));
    this.#jobs.push(...jobs);
    this.#emit();
    this.#pump();
    return jobs.map((job) => job.id);
  }
  cancel(id) {
    const job = this.#jobs.find((item) => item.id === id);
    if (!job) throw new Error('Download not found.');
    if (job.status === 'queued') job.status = 'cancelled';
    else if (job.status === 'running') { job.status = 'cancelling'; job.controller.abort(); }
    this.#emit();
  }
  retry(id) {
    if (this.#closed) throw new Error('The download queue is shutting down.');
    const job = this.#jobs.find((item) => item.id === id);
    if (!job || !['failed', 'cancelled'].includes(job.status)) throw new Error('Only failed or cancelled downloads can be retried.');
    Object.assign(job, { status: 'queued', interrupted: false, error: undefined, note: undefined, stage: undefined, loaded: 0, total: undefined, actualQuality: undefined, completedAt: undefined, speed: undefined, eta: undefined });
    this.#emit(); this.#pump();
  }
  interruptQueued() {
    for (const job of this.#jobs) if (job.status === 'queued') { job.interrupted = true; job.status = 'cancelled'; }
    this.#emit();
  }
  hasPending() { return this.#jobs.some((job) => ['queued', 'running', 'cancelling'].includes(job.status)); }
  async shutdown() {
    this.#closed = true;
    for (const job of this.#jobs) if (['queued', 'running'].includes(job.status)) { job.interrupted = true; this.cancel(job.id); }
    await this.#idle;
  }
  whenIdle() { return this.#idle; }
  #pump() {
    if (this.#active || this.#closed || this.#paused) return;
    const job = this.#jobs.find((item) => item.status === 'queued' && !this.#availability(item.videoId));
    if (!job) return;
    this.#active = job;
    job.controller = new AbortController();
    job.status = 'running';
    this.#emit();
    this.#idle = (async () => {
      const showProgress = createProgressFilter();
      try {
        const result = await this.run(job, {
          signal: job.controller.signal,
          onEvent: (event) => {
            if (!showProgress(event)) return;
            // Automatic fallbacks are internal; keep the active job on screen.
            if (event.type === 'retry') { job.note = undefined; return; }
            if (event.type === 'stage') Object.assign(job, { stage: event.stage, total: event.total, loaded: 0, startedAt: Date.now(), speed: undefined, eta: undefined });
            if (event.type === 'progress') {
              const speed = event.loaded / Math.max((Date.now() - job.startedAt) / 1000, 0.1);
              Object.assign(job, { loaded: event.loaded, total: event.total, speed, eta: event.total ? Math.max(0, Math.ceil((event.total - event.loaded) / speed)) : undefined });
            }
            if (event.type === 'start') job.actualQuality = event.quality;
            if (event.type === 'warning') job.note = event.message;
            this.#emit();
          },
        });
        Object.assign(job, { status: result.status, path: result.path, completedAt: Date.now() });
      } catch (error) {
        job.status = job.controller.signal.aborted || error.name === 'AbortError' ? 'cancelled' : 'failed';
        job.error = job.status === 'failed' ? error.message : undefined;
      } finally {
        delete job.controller;
        this.#active = undefined;
        this.#emit();
        this.#pump();
      }
    })();
  }
}
