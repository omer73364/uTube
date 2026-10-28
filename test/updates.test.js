import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { compareVersions, validateManifest, serviceStatus, isServiceBlocked, selectRelease, trustedAssetURL } from '../packages/core/update-policy.js';
import { verifyEnvelope, UpdateManager, fetchTrusted } from '../apps/desktop/src/main/updates.mjs';
import { DownloadQueue } from '../apps/desktop/src/main/queue.mjs';
const now = 1800000000000;
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const config = { manifestURL: 'https://omer73364.github.io/uTube/updates/manifest.json', keys: { test: publicKey.export({ type: 'spki', format: 'pem' }) } };
const bytes = Buffer.from('verified installer fixture');
const release = { version: '2.6.0', platform: 'linux', arch: 'x64', kind: 'deb', size: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'), url: 'https://github.com/omer73364/uTube/releases/download/v2.6.0/uTube-Desktop-2.6.0-linux-x64.deb', notes: { en: 'Fixes', ar: 'إصلاحات' } };
const rule = { provider: 'instagram', state: 'unavailable', message: { en: 'Outage', ar: 'توقف' }, fixedVersion: '2.6.0' };
const manifest = (patch = {}) => ({ schema: 1, revision: 5, issuedAt: now - 1000, expiresAt: now + 100000, services: [rule], releases: [release], ...patch });
const envelope = data => {
  const payload = Buffer.from(JSON.stringify(data));
  return JSON.stringify({ keyId: 'test', payload: payload.toString('base64'), signature: sign('sha256', payload, privateKey).toString('base64') });
};
async function manager(t, request, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-updates-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return new UpdateManager({ config, directory, version: '2.5.0', platform: 'linux', arch: 'x64', kind: 'deb', now: () => now, request, ...options });
}
const metadata = () => new Response(envelope(manifest()));

test('stable versions compare numerically and reject prereleases or garbage', () => {
  assert.equal(compareVersions('2.10.0', '2.9.9'), 1);
  assert.equal(compareVersions('2.5.0', '2.5.0'), 0);
  for (const input of ['2.6.0-beta', 'v2.5.0', '2.5', '2.5.0/../x']) assert.throws(() => compareVersions(input, '2.5.0'));
});
test('release targets select only a newer compatible artifact', () => {
  const data = manifest();
  assert.equal(selectRelease(data, 'linux', 'x64', '2.5.0', 'deb'), release);
  assert.equal(selectRelease(data, 'linux', 'arm64', '2.5.0', 'deb'), undefined);
  assert.equal(selectRelease(data, 'darwin', 'x64', '2.5.0'), undefined);
  assert.equal(selectRelease(data, 'linux', 'x64', '2.6.0'), undefined);
  const apk = { ...release, platform: 'android', arch: 'universal', kind: 'apk', versionCode: 6 };
  assert.equal(selectRelease({ releases: [apk] }, 'android', 'arm64', '2.5.0', 'apk', 5), apk);
  assert.equal(selectRelease({ releases: [apk] }, 'android', 'arm64', '2.5.0', 'apk', 7), undefined);
});
test('status restrictions are specific to provider, platform, version and expiry', () => {
  const data = manifest();
  assert.ok(isServiceBlocked(serviceStatus(data, 'instagram', 'linux', '2.5.0', now)));
  assert.equal(serviceStatus(data, 'youtube', 'linux', '2.5.0', now), undefined);
  assert.equal(serviceStatus(data, 'instagram', 'linux', '2.6.0', now), undefined);
  assert.equal(serviceStatus(data, 'instagram', 'linux', '2.5.0', now + 200000), undefined);
  assert.equal(serviceStatus(manifest({ services: [{ ...rule, platforms: ['android'] }] }), 'instagram', 'linux', '2.5.0', now), undefined);
  assert.equal(isServiceBlocked({ state: 'degraded' }), false);
});
test('manifest signature authenticates all metadata and rejects unknown identities', () => {
  const signed = envelope(manifest());
  assert.equal(verifyEnvelope(signed, config, now).revision, 5);
  const edited = JSON.parse(signed); edited.payload = Buffer.from(JSON.stringify(manifest({ revision: 9 }))).toString('base64');
  assert.throws(() => verifyEnvelope(JSON.stringify(edited), config, now), /signature/);
  edited.keyId = 'other';
  assert.throws(() => verifyEnvelope(JSON.stringify(edited), config, now), /signing key/);
});
test('expired, future, oversized, duplicate and malformed manifests are rejected', () => {
  assert.throws(() => validateManifest(manifest({ expiresAt: now - 1 }), now));
  assert.throws(() => validateManifest(manifest({ issuedAt: now + 400000 }), now));
  assert.throws(() => validateManifest(manifest({ releases: [release, release] }), now));
  assert.throws(() => validateManifest(manifest({ releases: [{ ...release, size: 2 ** 32 }] }), now));
  assert.throws(() => validateManifest(manifest({ releases: [{ ...release, platform: 'android' }] }), now));
  assert.throws(() => verifyEnvelope(' '.repeat(262145), config, now), /large/);
});
test('release URLs cannot point outside the pinned repository or disguise a different release', () => {
  for (const url of ['https://example.com/file.deb', 'http://github.com/omer73364/uTube/releases/download/v2.6.0/a.deb',
    'https://github.com/other/project/releases/download/v2.6.0/a.deb', 'https://github.com/omer73364/uTube/releases/download/v2.6.0/a.deb?x=1']) assert.throws(() => trustedAssetURL(url));
  assert.throws(() => validateManifest(manifest({ releases: [{ ...release, url: release.url.replace('/v2.6.0/', '/v2.7.0/') }] }), now));
});
test('an unconfigured build never requests a feed or disables providers', async t => {
  const updates = await manager(t, () => { throw new Error('must not fetch'); }, { config: { ...config, keys: {} } });
  assert.equal((await updates.check()).phase, 'unconfigured');
  assert.deepEqual(updates.snapshot().services, []);
});
test('verified check and download produce a staged installer, reverified before installation', async t => {
  const updates = await manager(t, async (_url, options) => options?.manifest ? metadata() : new Response(bytes));
  assert.equal((await updates.check()).phase, 'available');
  assert.equal(updates.snapshot().services[0].provider, 'instagram');
  assert.equal((await updates.download()).phase, 'ready');
  const file = await updates.verifiedFile();
  assert.deepEqual(await fs.readFile(file), bytes);
  await fs.writeFile(file, 'tampered');
  await assert.rejects(updates.verifiedFile(), /verification/);
  assert.equal(updates.snapshot().phase, 'available');
});
test('mismatched hashes or sizes never leave an installable file', async t => {
  for (const body of [Buffer.from('bad'), Buffer.alloc(bytes.length, 1), Buffer.alloc(bytes.length + 1)]) {
    const updates = await manager(t, async (_url, options) => options?.manifest ? metadata() : new Response(body));
    await updates.check(); await updates.download();
    assert.equal(updates.snapshot().error, 'download');
    assert.equal(updates.file, undefined);
    assert.deepEqual((await fs.readdir(updates.directory)).filter(file => file.endsWith('.part')), []);
  }
});
test('offline checks retain a valid cached outage but expired cached notices fail open', async t => {
  let clock = now;
  const updates = await manager(t, async () => metadata(), { now: () => clock });
  await updates.check();
  const restored = new UpdateManager({ config, directory: updates.directory, version: '2.5.0', platform: 'linux', now: () => clock, request: async () => { throw new Error('offline'); } });
  await restored.initialize(); await restored.check();
  assert.equal(restored.snapshot().services.length, 1);
  clock += 200000; restored.refreshServices();
  assert.equal(restored.snapshot().statusVerified, false);
  assert.equal(restored.snapshot().services.length, 0);
});
test('replayed revisions are rejected, including after a cached manifest expires', async t => {
  const updates = await manager(t, async () => metadata());
  await updates.check();
  let clock = now + 200000;
  const restored = new UpdateManager({ config, directory: updates.directory, version: '2.5.0', platform: 'linux', now: () => clock,
    request: async () => new Response(envelope(manifest({ revision: 4, issuedAt: clock - 1000, expiresAt: clock + 100000 }))) });
  await restored.initialize(); await restored.check();
  assert.equal(restored.snapshot().error, 'check');
  assert.equal(restored.manifest.revision, 5);
});
test('cancelling an update removes partial data and permits retry', async t => {
  let updates;
  updates = await manager(t, async (_url, options) => {
    if (options?.manifest) return metadata();
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(bytes); updates.cancel(); controller.close(); } }));
  });
  await updates.check(); await updates.download();
  assert.equal(updates.snapshot().phase, 'available');
  assert.equal(updates.snapshot().error, undefined);
  assert.equal(updates.file, undefined);
});
test('single download failure does not change signed service availability', async t => {
  const updates = await manager(t, async () => new Response(envelope(manifest({ services: [] }))));
  await updates.check();
  const queue = new DownloadQueue(async () => { throw new Error('Private video'); });
  queue.add([{ videoId: 'ig-ABCDE-1' }]); await queue.whenIdle();
  assert.equal(queue.snapshot()[0].status, 'failed');
  assert.deepEqual(updates.snapshot().services, []);
});
test('held provider jobs do not block healthy services and continue on recovery', async () => {
  const calls = [];
  const queue = new DownloadQueue(async job => { calls.push(job.videoId); return { status: 'saved' }; });
  queue.setAvailability(id => id.startsWith('ig-') ? 'instagram' : undefined);
  queue.add([{ videoId: 'ig-ABCDE-1' }, { videoId: 'youtube-id' }]);
  await queue.whenIdle();
  assert.deepEqual(calls, ['youtube-id']);
  assert.equal(queue.snapshot()[0].holdReason, 'instagram');
  queue.setAvailability(() => undefined); await queue.whenIdle();
  assert.deepEqual(calls, ['youtube-id', 'ig-ABCDE-1']);
});
test('outage does not cancel an already running transfer', async () => {
  let finish;
  const queue = new DownloadQueue(() => new Promise(resolve => { finish = resolve; }));
  queue.add([{ videoId: 'ig-ABCDE-1' }]);
  queue.setAvailability(() => 'instagram');
  assert.equal(queue.snapshot()[0].status, 'running');
  finish({ status: 'saved' }); await queue.whenIdle();
  assert.equal(queue.snapshot()[0].status, 'saved');
});
test('update drain finishes current transfer and preserves queued jobs for restart', async () => {
  let finish; const calls = [];
  const queue = new DownloadQueue(job => { calls.push(job.videoId); return new Promise(resolve => { finish = resolve; }); });
  queue.add([{ videoId: 'one' }, { videoId: 'two' }]);
  const draining = queue.prepareUpdate();
  finish({ status: 'saved' }); await draining;
  assert.deepEqual(calls, ['one']);
  assert.equal(queue.snapshot()[1].status, 'queued');
  assert.equal(queue.snapshot()[1].holdReason, 'update');
  await queue.shutdown();
  assert.equal(queue.snapshot()[1].interrupted, true);
});
test('install-now interrupts the current job and cancelling installation releases queue hold', async () => {
  const queue = new DownloadQueue((_job, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), { once: true });
  }));
  queue.add([{ videoId: 'one' }, { videoId: 'two' }]);
  await queue.prepareUpdate(true);
  assert.equal(queue.snapshot()[0].interrupted, true);
  assert.equal(queue.snapshot()[0].status, 'cancelled');
  queue.resume(); assert.equal(queue.snapshot()[1].status, 'running');
  await queue.shutdown();
});


test('update redirects are bounded and cannot escape trusted CDN hosts', async t => {
  const priorFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = priorFetch; });
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://attacker.example/update.exe' } }); };
  await assert.rejects(fetchTrusted(release.url), /Untrusted update host/);
  assert.equal(calls, 1);
  calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: release.url } }); };
  await assert.rejects(fetchTrusted(release.url), /Too many update redirects/);
  assert.equal(calls, 6);
});
test('download rejects expired metadata with a visible check error', async t => {
  let clock = now;
  const updates = await manager(t, async () => metadata(), { now: () => clock });
  await updates.check(); clock += 200000;
  assert.equal((await updates.download()).error, 'check');
  assert.equal(updates.file, undefined);
});
test('pre-install queue persistence can be retried safely if opening an installer fails', async () => {
  const queue = new DownloadQueue(async () => ({ status: 'saved' }));
  queue.pause(); queue.add([{ videoId: 'one' }]);
  queue.interruptQueued(); queue.resume();
  assert.equal(queue.snapshot()[0].status, 'cancelled');
  assert.equal(queue.snapshot()[0].interrupted, true);
  queue.retry(queue.snapshot()[0].id); await queue.whenIdle();
  assert.equal(queue.snapshot()[0].status, 'saved');
});
