import fs from 'node:fs/promises';
import path from 'node:path';
import { specialRemover } from '../../../../packages/core/urls.js';
import { validateJobID, validateRequest } from './validation.mjs';
import { safeMediaThumbnail } from '../../../../packages/core/media-source.js';

const fields = ['id', 'videoId', 'thumbnail', 'title', 'folder', 'playlistTitle', 'audio', 'quality', 'status', 'path', 'actualQuality', 'note', 'error', 'interrupted', 'createdAt', 'completedAt'];
const statuses = ['queued', 'running', 'cancelling', 'saved', 'skipped', 'failed', 'cancelled'];
const record = (job) => Object.fromEntries(fields.filter((key) => job[key] !== undefined).map((key) => [key, job[key]]));

function restoreRecord(value) {
  if (!value || typeof value !== 'object') throw new Error('Invalid history entry.');
  validateJobID(value.id);
  if (typeof value.title !== 'string' || value.title.length > 1100 || typeof value.folder !== 'string' || !path.isAbsolute(value.folder) || !statuses.includes(value.status)) throw new Error('Invalid history entry.');
  validateRequest({ audio: value.audio, quality: value.quality, playlistTitle: value.playlistTitle, items: [{ id: value.videoId, title: value.title.slice(0, 1000) }] });
  const job = record(value);
  if (job.thumbnail !== undefined) job.thumbnail = safeMediaThumbnail(job.thumbnail);
  for (const key of ['actualQuality', 'note', 'error']) if (job[key] !== undefined && (typeof job[key] !== 'string' || job[key].length > 10000)) delete job[key];
  for (const key of ['createdAt', 'completedAt']) if (!Number.isFinite(job[key]) || job[key] < 0 || job[key] > 8640000000000000) delete job[key];
  job.interrupted = job.interrupted === true;
  if (['saved', 'skipped'].includes(job.status)) {
    const expected = path.join(job.folder, ...(job.playlistTitle ? [specialRemover(job.playlistTitle)] : []), `${specialRemover(job.title)} [${job.videoId}].${job.audio ? 'mp3' : 'mp4'}`);
    if (job.path !== expected) throw new Error('Invalid saved file path.');
  } else delete job.path;
  return job;
}

export class DownloadHistory {
  #pending = Promise.resolve();
  #last;
  #disabled = false;
  warning;
  constructor(filename) { this.filename = filename; }
  async load() {
    let text;
    try { text = await fs.readFile(this.filename, 'utf8'); }
    catch (error) {
      if (error.code === 'ENOENT') return [];
      this.#disabled = true;
      this.warning = 'Download history could not be read. Changes cannot be saved.';
      return [];
    }
    try {
      const data = JSON.parse(text);
      if (data.version !== 1 || !Array.isArray(data.jobs)) throw new Error('Invalid history file.');
      const ids = new Set();
      return data.jobs.map((value) => {
        const job = restoreRecord(value);
        if (ids.has(job.id)) throw new Error('Duplicate history entry.');
        ids.add(job.id);
        return job;
      });
    } catch {
      // Preserve the original before starting a fresh history; never overwrite
      // damaged or newer-version data that a user may want to recover.
      try {
        await fs.rename(this.filename, `${this.filename}.backup-${Date.now()}`);
        this.warning = 'Download history could not be restored. A backup was kept.';
      } catch {
        this.#disabled = true;
        this.warning = 'Download history could not be read. Changes cannot be saved.';
      }
      return [];
    }
  }
  save(jobs) {
    if (this.#disabled) return Promise.reject(new Error(this.warning));
    const text = JSON.stringify({ version: 1, jobs: jobs.map(record) });
    // Transfer progress is intentionally excluded: write state transitions,
    // not every downloaded chunk. Serialize writes to avoid stale snapshots.
    if (text === this.#last) return this.#pending;
    this.#last = text;
    this.#pending = this.#pending.catch(() => {}).then(async () => {
      try {
        await fs.mkdir(path.dirname(this.filename), { recursive: true });
        await fs.writeFile(`${this.filename}.tmp`, text, { mode: 0o600 });
        await fs.rename(`${this.filename}.tmp`, this.filename);
      } catch (error) {
        if (this.#last === text) this.#last = undefined;
        throw error;
      }
    });
    return this.#pending;
  }
  flush() { return this.#disabled ? Promise.reject(new Error(this.warning)) : this.#pending; }
}
