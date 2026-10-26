import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createFFmpegManager } from '../packages/core/ffmpeg.js';

const hash = value => createHash('sha256').update(value).digest('hex');
async function fixture(t, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-ffmpeg-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const binary = Buffer.from('verified fixture executable');
  const assets = { binary: gzipSync(binary), license: Buffer.from('license text'), readme: Buffer.from('build source information') };
  const spec = { executableSha256: hash(binary) };
  for (const [key, data] of Object.entries(assets)) spec[key] = { url: `https://example.test/${key}`, size: data.length, sha256: hash(data) };
  let requests = 0;
  const manager = createFFmpegManager({ directory, platform: 'linux', arch: 'x64', manifest: { 'linux-x64': spec },
    probe: async file => file !== 'ffmpeg', fetch: async url => {
      requests++;
      return new Response(assets[url.split('/').at(-1)]);
    }, ...options });
  return { manager, assets, spec, directory, requests: () => requests };
}
test('FFmpeg setup verifies all downloads, reports progress, and reuses the installed tool', async t => {
  const f = await fixture(t); const updates = [];
  assert.equal(await f.manager.resolve(), null);
  const file = await f.manager.install({ onProgress: value => updates.push(value) });
  assert.equal(await f.manager.resolve(), file);
  assert.equal(await fs.readFile(path.join(path.dirname(file), 'LICENSE'), 'utf8'), 'license text');
  assert.equal(updates.at(-1).loaded, updates.at(-1).total);
  await f.manager.install(); assert.equal(f.requests(), 3);
  await fs.writeFile(file, 'tampered');
  assert.equal(await f.manager.resolve(), null);
  await f.manager.install(); assert.equal(await f.manager.resolve(), file);
});
test('FFmpeg setup rejects changed assets and leaves no executable or temporary directories', async t => {
  const f = await fixture(t); f.spec.binary.sha256 = '0'.repeat(64);
  await assert.rejects(f.manager.install(), /verification failed/);
  assert.equal(await f.manager.resolve(), null);
  assert.deepEqual(await fs.readdir(path.dirname(path.dirname(f.manager.executable))), []);
});
test('FFmpeg setup retries after cancellation and shares simultaneous installation requests', async t => {
  const f = await fixture(t); const controller = new AbortController(); controller.abort();
  await assert.rejects(f.manager.install({ signal: controller.signal }), /abort/i);
  const before = f.requests();
  const [first, second] = await Promise.all([f.manager.install(), f.manager.install()]);
  assert.equal(first, second); assert.equal(f.requests() - before, 3);
});
test('system FFmpeg wins and unsupported devices do not download anything', async t => {
  const f = await fixture(t, { probe: async () => true });
  assert.equal(await f.manager.resolve(), 'ffmpeg'); assert.equal(f.requests(), 0);
  const other = await fixture(t, { platform: 'unsupported' });
  assert.equal(other.manager.supported, false);
  await assert.rejects(other.manager.install(), /not available/);
  assert.equal(other.requests(), 0);
});
test('invalid executable and HTTP errors never publish a managed tool', async t => {
  const f = await fixture(t, { probe: async () => false });
  await assert.rejects(f.manager.install(), /could not run/);
  assert.equal(await f.manager.resolve(), null);
  const network = await fixture(t, { fetch: async () => new Response('unavailable', { status: 503 }) });
  await assert.rejects(network.manager.install(), /HTTP 503/);
});
test('FFmpeg setup rejects oversized downloads and corrupt gzip data', async t => {
  const large = await fixture(t); large.spec.binary.size = 1;
  await assert.rejects(large.manager.install(), /exceeded/);
  const corrupt = await fixture(t); const bytes = Buffer.from('not gzip data');
  corrupt.assets.binary = bytes; corrupt.spec.binary.size = bytes.length; corrupt.spec.binary.sha256 = hash(bytes);
  await assert.rejects(corrupt.manager.install());
  assert.equal(await corrupt.manager.resolve(), null);
});
test('FFmpeg setup does not hide invalid explicit executable overrides', async t => {
  const f = await fixture(t, { probe: async file => file === 'ffmpeg' });
  const previous = process.env.UTUBE_FFMPEG;
  try {
    process.env.UTUBE_FFMPEG = '/missing/explicit/ffmpeg';
    assert.equal(await f.manager.resolve(), null);
    await assert.rejects(f.manager.install(), /UTUBE_FFMPEG is set/);
    assert.equal(f.requests(), 0);
  } finally {
    if (previous === undefined) delete process.env.UTUBE_FFMPEG; else process.env.UTUBE_FFMPEG = previous;
  }
});
