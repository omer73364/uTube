import test from 'node:test';
import assert from 'node:assert/strict';
import { DownloadQueue } from '../apps/desktop/src/main/queue.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));
test('restored unfinished work waits for manual retry and keeps its playlist metadata', async () => {
  const calls = [];
  const queue = new DownloadQueue(async (job) => { calls.push(job); return { status: 'saved', path: '/tmp/saved.mp4' }; });
  queue.restore(['queued', 'running', 'cancelling', 'saved', 'failed'].map((status, index) => ({ id: String(index), status, title: 'Saved video', playlistTitle: 'Playlist', createdAt: 123 })));
  assert.deepEqual(calls, []);
  assert.deepEqual(queue.snapshot().map((job) => job.status), ['cancelled', 'cancelled', 'cancelled', 'saved', 'failed']);
  assert.ok(queue.snapshot().slice(0, 3).every((job) => job.interrupted));
  queue.retry('1'); await tick();
  assert.equal(calls[0].playlistTitle, 'Playlist');
  assert.equal(queue.snapshot()[1].status, 'saved');
  assert.equal(queue.snapshot()[1].interrupted, false);
});

test('saved history does not use up the unfinished-download limit', async () => {
  const queue = new DownloadQueue(async () => ({ status: 'saved', path: '/tmp/file.mp4' }));
  queue.restore(Array.from({ length: 501 }, (_, i) => ({ id: String(i), status: 'saved' })));
  assert.doesNotThrow(() => queue.add([{ videoId: 'new' }]));
  await tick();
  assert.equal(queue.snapshot().length, 502);
});
test('automatic fallbacks stay silent while the same queue job succeeds', async () => {
  const snapshots = [];
  const queue = new DownloadQueue(async (job, { onEvent }) => {
    onEvent({ type: 'stage', stage: 'video', total: 100 });
    onEvent({ type: 'progress', loaded: 20, total: 100 });
    onEvent({ type: 'retry', message: 'HTTP 403; refreshing download links' });
    onEvent({ type: 'start', quality: '360p' });
    onEvent({ type: 'stage', stage: 'video', total: 80 });
    onEvent({ type: 'progress', loaded: 5, total: 80 });
    onEvent({ type: 'progress', loaded: 80, total: 80 });
    return { status: 'saved', path: '/tmp/success.mp4' };
  }, (jobs) => snapshots.push(jobs));
  queue.add([{ videoId: 'fallback' }]);
  await queue.whenIdle();
  assert.ok(snapshots.every(([job]) => !job.note));
  const running = snapshots.map(([job]) => job).filter((job) => job.status === 'running');
  assert.ok(running.every((job, i) => i === 0 || job.loaded >= running[i - 1].loaded));
  assert.equal(queue.snapshot()[0].status, 'saved');
  assert.equal(queue.snapshot()[0].actualQuality, '360p');
});

test('queue runs sequentially and continues after failures', async () => {
  const calls = [];
  let release;
  const first = new Promise((resolve) => { release = resolve; });
  const queue = new DownloadQueue(async (job) => {
    calls.push(job.videoId);
    if (job.videoId === 'first') await first;
    if (job.videoId === 'second') throw new Error('Unavailable video');
    return { status: 'saved', path: `/tmp/${job.videoId}.mp4` };
  });
  queue.add([{ videoId: 'first' }, { videoId: 'second' }, { videoId: 'third' }]);
  assert.deepEqual(calls, ['first']);
  release(); await tick();
  assert.deepEqual(calls, ['first', 'second', 'third']);
  assert.deepEqual(queue.snapshot().map((job) => job.status), ['saved', 'failed', 'saved']);
  assert.doesNotThrow(() => JSON.stringify(queue.snapshot()));
});

test('cancelled queued items do not run, and shutdown waits for active cleanup', async () => {
  let cleaned = false;
  const queue = new DownloadQueue(async (job, { signal }) => {
    await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
    await tick(); cleaned = true;
    throw new DOMException('Cancelled', 'AbortError');
  });
  const [first, second] = queue.add([{ videoId: 'first' }, { videoId: 'second' }]);
  queue.cancel(second);
  assert.equal(queue.snapshot()[1].status, 'cancelled');
  await queue.shutdown();
  assert.ok(cleaned);
  assert.equal(queue.snapshot()[0].status, 'cancelled');
  assert.throws(() => queue.add([]), /shutting down/);
  assert.throws(() => queue.retry(first), /shutting down/);
});

test('failed downloads can be retried without duplicating queue entries', async () => {
  let attempts = 0;
  const queue = new DownloadQueue(async () => { if (!attempts++) throw new Error('Offline'); return { status: 'saved', path: '/tmp/file.mp4' }; });
  const [id] = queue.add([{ videoId: 'first' }]);
  await tick();
  queue.retry(id); await tick();
  assert.equal(queue.snapshot().length, 1);
  assert.equal(queue.snapshot()[0].status, 'saved');
});

test('desktop requests reject unsafe URLs, malformed jobs, and arbitrary options', async () => {
  const { validateURL, validateRequest, validateJobID } = await import('../apps/desktop/src/main/validation.mjs');
  assert.throws(() => validateURL('https://example.com/watch?v=jNQXAC9IVRw'), /YouTube/);
  assert.throws(() => validateRequest({ audio: true, quality: '720p', items: [{ id: 'jNQXAC9IVRw', title: 'Video' }] }), /MP3/);
  assert.throws(() => validateJobID('../../secret'), /Invalid/);
  const request = validateRequest({ audio: false, quality: '720p', folder: '/arbitrary', items: [{ id: 'jNQXAC9IVRw', title: 'Video' }] });
  assert.equal(request.folder, undefined);
  assert.equal(request.items[0].index, 0);
});
