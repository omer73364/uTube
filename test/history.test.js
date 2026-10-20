import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DownloadHistory } from '../apps/desktop/src/main/history.mjs';

const entry = (folder, values = {}) => ({ id: randomUUID(), videoId: 'jNQXAC9IVRw', title: 'Video', folder, audio: false, quality: '720p', status: 'queued', createdAt: 123, ...values });
test('history keeps playlist metadata and completed files without transient transfer state', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-history-'));
  const filename = path.join(root, 'downloads.json');
  try {
    const store = new DownloadHistory(filename);
    assert.deepEqual(await store.load(), []);
    const job = entry(root, { title: '#1_Video', playlistTitle: 'Weekend', status: 'saved', path: path.join(root, 'Weekend', '#1_Video [jNQXAC9IVRw].mp4'), completedAt: 456, loaded: 99, stage: 'video', controller: new AbortController() });
    await store.save([job]);
    const [restored] = await new DownloadHistory(filename).load();
    assert.equal(restored.playlistTitle, 'Weekend');
    assert.equal(restored.path, job.path);
    assert.equal(restored.id, job.id);
    assert.equal(restored.completedAt, 456);
    assert.equal(restored.controller, undefined);
    assert.equal(restored.loaded, undefined);
    assert.equal(restored.stage, undefined);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('ordered atomic history writes finish with the latest state and survive failed writes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-history-write-'));
  const filename = path.join(root, 'downloads.json');
  try {
    const store = new DownloadHistory(filename);
    const job = entry(root);
    const first = store.save([job]);
    const second = store.save([{ ...job, status: 'running' }]);
    await Promise.all([first, second]);
    await store.flush();
    assert.equal((await new DownloadHistory(filename).load())[0].status, 'running');
    await fs.mkdir(`${filename}.tmp`);
    await assert.rejects(store.save([{ ...job, status: 'cancelled' }]));
    assert.equal((await new DownloadHistory(filename).load())[0].status, 'running');
    await fs.rmdir(`${filename}.tmp`);
    await store.save([{ ...job, status: 'cancelled' }]);
    assert.equal((await new DownloadHistory(filename).load())[0].status, 'cancelled');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('corrupt or unsafe history is backed up without opening arbitrary paths', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-history-backup-'));
  const filename = path.join(root, 'downloads.json');
  try {
    const text = JSON.stringify({ version: 1, jobs: [entry(root, { status: 'saved', path: '/tmp/not-a-downloaded-file' })] });
    await fs.writeFile(filename, text);
    const store = new DownloadHistory(filename);
    assert.deepEqual(await store.load(), []);
    assert.match(store.warning, /backup was kept/);
    const [backup] = (await fs.readdir(root)).filter((name) => name.includes('.backup-'));
    assert.equal(await fs.readFile(path.join(root, backup), 'utf8'), text);
    await store.save([]);
    assert.deepEqual(await new DownloadHistory(filename).load(), []);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
