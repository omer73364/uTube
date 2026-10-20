import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDownloadEngine } from '../packages/core/engine.js';

const format = { itag: 18, url: 'https://example.test/video', has_video: true, has_audio: true, mime_type: 'video/mp4', quality_label: '360p' };
const info = { basic_info: { title: 'Core test', author: 'uTube' }, streaming_data: { formats: [format] }, download: async () => new ReadableStream({ start(c) { c.enqueue(Buffer.from('media')); c.close(); } }) };

for (const quality of ['720p', '1080p']) {
  test(`${quality} retries other clients at the same resolution instead of downloading 360p`, async () => {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-quality-'));
    const clients = [];
    const events = [];
    const high = { ...format, itag: 137, quality_label: quality };
    const hd = { ...info, streaming_data: { formats: [high] } };
    const engine = createDownloadEngine({ client: { getInfo: async (id, { client }) => {
      clients.push(client);
      return client === 'ANDROID_VR' ? hd : info;
    } } });
    try {
      const result = await engine.download({ folder, item: { id: 'hd' }, quality, onEvent: (event) => events.push(event) });
      assert.equal(result.status, 'saved');
      assert.deepEqual(clients, ['IOS', 'VISIONOS', 'ANDROID_VR']);
      assert.deepEqual(events.filter((event) => event.type === 'start').map((event) => event.quality), [quality]);
    } finally { await fs.rm(folder, { recursive: true, force: true }); }
  });
}

test('unavailable HD falls back to the highest lower resolution across all clients', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-unavailable-'));
  const clients = [];
  const events = [];
  const engine = createDownloadEngine({ client: { getInfo: async (id, { client }) => {
    clients.push(client);
    return client === 'VISIONOS' ? { ...info, streaming_data: { formats: [{ ...format, quality_label: '720p' }] } } : info;
  } } });
  try {
    const result = await engine.download({ folder, item: { id: 'hd' }, quality: '1080p', onEvent: (event) => events.push(event) });
    assert.equal(result.status, 'saved');
    assert.deepEqual(clients, ['IOS', 'VISIONOS', 'ANDROID_VR', 'ANDROID']);
    assert.deepEqual(events.filter((event) => event.type === 'start').map((event) => event.quality), ['720p']);
    assert.match(events.find((event) => event.type === 'warning').message, /1080p.*720p/);
    assert.equal(events.at(-1).type, 'saved');
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
});

test('a rejected HD stream falls back only after exhausting clients at the requested quality', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-rejected-hd-'));
  const downloads = [];
  const hd = { ...info, streaming_data: { formats: [{ ...format, itag: 137, quality_label: '1080p' }] }, download: async ({ itag }) => {
    downloads.push(itag);
    const error = new Error('rejected');
    error.info = { response: { status: 403 } };
    throw error;
  } };
  const clients = [];
  const low = { ...info, download: async () => {
    assert.deepEqual(clients, ['IOS', 'VISIONOS', 'ANDROID_VR', 'ANDROID']);
    downloads.push(18);
    return info.download();
  } };
  const engine = createDownloadEngine({ client: { getInfo: async (id, { client }) => {
    clients.push(client);
    return client === 'IOS' ? hd : low;
  } } });
  try {
    const result = await engine.download({ folder, item: { id: 'hd' }, quality: '1080p' });
    assert.equal(result.status, 'saved');
    assert.deepEqual(downloads, [137, 18]);
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
});

test('lower-quality fallbacks descend until a working format is found', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-best-fallback-'));
  const calls = [];
  const events = [];
  const source = { ...info, streaming_data: { formats: ['360p', '720p', '480p', '1440p'].map((quality_label, index) => ({ ...format, itag: index + 1, quality_label })) },
    download: async ({ itag }) => {
      calls.push(itag);
      if (itag === 2) { const error = new Error('rejected'); error.info = { response: { status: 403 } }; throw error; }
      return info.download();
    },
  };
  const engine = createDownloadEngine({ client: { getInfo: async () => source } });
  try {
    const result = await engine.download({ folder, item: { id: 'hd' }, quality: '1080p', onEvent: (event) => events.push(event) });
    assert.equal(result.status, 'saved');
    assert.deepEqual(calls, [2, 2, 2, 2, 3]);
    const warnings = events.filter((event) => event.type === 'warning');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0].message, /480p/);
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
});

test('an HD format failure tries another encoding at the same resolution', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-encoding-'));
  const calls = [];
  const hd = { ...info, streaming_data: { formats: [format, { ...format, itag: 137, quality_label: '1080p' }, { ...format, itag: 399, quality_label: '1080p' }] },
    download: async ({ itag }) => {
      calls.push(itag);
      if (itag === 137) { const error = new Error('rejected'); error.info = { response: { status: 403 } }; throw error; }
      return info.download();
    },
  };
  const engine = createDownloadEngine({ client: { getInfo: async () => hd } });
  try {
    await engine.download({ folder, item: { id: 'hd' }, quality: '1080p' });
    assert.deepEqual(calls, [137, 399]);
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
});

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

test('cancellation terminates an encoder that ignores SIGTERM and cleans its files', { skip: process.platform === 'win32', timeout: 10000 }, async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-encoder-cancel-'));
  const executable = path.join(folder, 'fake-ffmpeg');
  const marker = path.join(folder, 'started');
  await fs.writeFile(executable, `#!/usr/bin/env node\nif(process.argv.includes('-version'))process.exit(0);\nprocess.on('SIGTERM',()=>{});\nrequire('node:fs').writeFileSync(${JSON.stringify(marker)},'ready');\nsetInterval(()=>{},1000);\n`, { mode: 0o755 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  const interval = setInterval(() => { void fs.access(marker).then(() => { clearInterval(interval); controller.abort(); }).catch(() => {}); }, 20);
  const engine = createDownloadEngine({ client: { getInfo: async () => info }, ffmpegPath: executable });
  try {
    await assert.rejects(engine.download({ folder, item: { id: 'encoding' }, audio: true, signal: controller.signal }), { name: 'AbortError' });
    await fs.access(marker);
    assert.equal((await fs.readdir(folder)).some((entry) => entry.startsWith('.utube-') || entry.endsWith('.mp3')), false);
  } finally { clearInterval(interval); clearTimeout(timer); await fs.rm(folder, { recursive: true, force: true }); }
});


test('long Unicode titles stay within filesystem filename limits', async () => {
  const { specialRemover } = await import('../packages/core/urls.js');
  const name = specialRemover('تعز日本語🎧'.repeat(40));
  assert.ok(Buffer.byteLength(name, 'utf8') <= 180);
  assert.ok(!name.includes('�'));
});
