import test from 'node:test';
import assert from 'node:assert/strict';
import { DownloadQueue } from '../apps/desktop/src/main/queue.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));
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
