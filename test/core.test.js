import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDownloadEngine } from '../packages/core/engine.js';

const format = { itag: 18, url: 'https://example.test/video', has_video: true, has_audio: true, mime_type: 'video/mp4', quality_label: '360p' };
const info = { basic_info: { title: 'Core test', author: 'uTube' }, streaming_data: { formats: [format] }, download: async () => new ReadableStream({ start(c) { c.enqueue(Buffer.from('media')); c.close(); } }) };

test('the core accepts explicit dependencies and emits serializable progress without a terminal', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-core-'));
  const events = [];
  const engine = createDownloadEngine({ client: { getInfo: async () => info } });
  try {
    const preview = await engine.inspect('https://youtu.be/jNQXAC9IVRw');
    assert.equal(preview.title, 'Core test');
    assert.deepEqual(preview.qualities, ['360p']);
    const result = await engine.download({ folder, item: { id: 'jNQXAC9IVRw' }, quality: '360p', onEvent: (event) => events.push(JSON.parse(JSON.stringify(event))) });
    assert.equal(await fs.readFile(result.path, 'utf8'), 'media');
    assert.deepEqual(events.map((event) => event.type), ['start', 'stage', 'progress', 'saved']);
    assert.equal(events[2].loaded, 5);
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
});

test('cancelling a transfer closes its stream, removes temporary files, and never retries', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-cancel-'));
  const controller = new AbortController();
  let cancelled = false;
  let requests = 0;
  const blocked = { ...info, download: async () => {
    requests++;
    return new ReadableStream({ start(c) { c.enqueue(Buffer.from('partial')); }, cancel() { cancelled = true; } });
  } };
  const engine = createDownloadEngine({ client: { getInfo: async () => blocked } });
  try {
    await assert.rejects(engine.download({ folder, item: { id: 'cancelled' }, quality: '360p', signal: controller.signal,
      onEvent(event) { if (event.type === 'progress') controller.abort(); },
    }), { name: 'AbortError' });
    assert.equal(cancelled, true);
    assert.equal(requests, 1);
    assert.deepEqual(await fs.readdir(folder), []);
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
});

test('cancelling metadata stops waiting even if the upstream request is stalled', async () => {
  const controller = new AbortController();
  const engine = createDownloadEngine({ client: { getInfo: () => new Promise(() => {}) } });
  const pending = engine.inspect('https://youtu.be/jNQXAC9IVRw', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
