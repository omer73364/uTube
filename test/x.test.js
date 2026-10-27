import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createDownloadEngine } from '../packages/core/engine.js';
import { createXClient } from '../packages/core/x.js';
import { parseMediaURL, safeMediaThumbnail } from '../packages/core/media-source.js';
import { validateURL, validateRequest } from '../apps/desktop/src/main/validation.mjs';
import { DownloadHistory } from '../apps/desktop/src/main/history.mjs';

const postId = '1577855540407197696';
const videoId = `x-${postId}-1`;
const variant = (width, height, bitrate = 1) => ({ content_type: 'video/mp4', bitrate, url: `https://video.twimg.com/ext_tw_video/1/pu/vid/${width}x${height}/video.mp4` });
const media = (variants = [variant(640, 360), variant(1280, 720, 2)]) => ({ type: 'video', media_url_https: 'https://pbs.twimg.com/ext_tw_video_thumb/test.jpg', video_info: { duration_millis: 1000, variants } });
const post = (mediaDetails = [media()]) => ({ id_str: postId, text: 'A public video https://t.co/abc', user: { name: 'uTube Studio' }, mediaDetails });
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
const engine = (fetcher) => createDownloadEngine({ client: { getInfo() { throw new Error('X must not connect to YouTube'); } }, xClient: createXClient({ fetch: fetcher }) });
async function folder(t) { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-x-')); t.after(() => fs.rm(root, { recursive: true, force: true })); return root; }

test('X links accept both domains, mobile aliases, share queries, and specific videos', () => {
  for (const host of ['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com', 'm.twitter.com']) {
    assert.equal(validateURL(`https://${host}/studio/status/${postId}?s=20`), `https://${host}/studio/status/${postId}?s=20`);
    assert.equal(parseMediaURL(`https://${host}/studio/status/${postId}/video/2`).id, `x-${postId}-2`);
  }
  assert.equal(parseMediaURL(`x.com/i/web/status/${postId}`).provider, 'x');
  assert.equal(parseMediaURL(`https://x.com/i/status/${postId}`).id, videoId);
  assert.equal(parseMediaURL('https://youtu.be/jNQXAC9IVRw').provider, 'youtube');
  for (const url of [`https://x.com.evil.test/a/status/${postId}`, `https://x.com@evil.test/a/status/${postId}`, `https://user@x.com/a/status/${postId}`, `https://x.com:8443/a/status/${postId}`, `file://x.com/a/status/${postId}`, 'https://x.com/a', `https://x.com/a/status/${postId}/video/5`, 'https://x.com/a/status/0000000000000000001']) assert.throws(() => parseMediaURL(url), /valid YouTube or X/);
});

test('X previews expose actual MP4 qualities, metadata and safe thumbnails without connecting to YouTube', async () => {
  const calls = [];
  const e = engine(async (url, options) => { calls.push({ url: new URL(url), options }); return json(post([media([variant(720, 900, 3), variant(480, 600, 2), variant(320, 400)])])); });
  const preview = await e.inspect(`https://x.com/studio/status/${postId}`);
  assert.equal(preview.provider, 'x');
  assert.equal(preview.id, videoId);
  assert.equal(preview.author, 'uTube Studio');
  assert.equal(preview.duration, 1);
  assert.deepEqual(preview.qualities, ['320p', '480p', '720p']);
  assert.match(preview.title, /A public video/);
  assert.doesNotMatch(preview.title, /t\.co/);
  assert.equal(preview.thumbnail, 'https://pbs.twimg.com/ext_tw_video_thumb/test.jpg');
  assert.ok(calls[0].url.searchParams.get('token'));
  assert.equal(calls[0].url.hostname, 'cdn.syndication.twimg.com');
  assert.equal(calls[0].options.redirect, 'error');
});

test('multi-video posts use existing selection while /video/N selects only that video', async () => {
  const e = engine(async () => json(post([{ type: 'photo' }, media(), media([variant(1920, 1080)])])));
  const preview = await e.inspect(`https://twitter.com/studio/status/${postId}`);
  assert.equal(preview.type, 'playlist');
  assert.deepEqual(preview.items.map(item => item.id), [videoId, `x-${postId}-2`]);
  assert.deepEqual(preview.qualities, ['360p', '720p', '1080p']);
  const selected = await e.inspect(`https://x.com/studio/status/${postId}/video/2`);
  assert.equal(selected.type, 'video');
  assert.equal(selected.id, `x-${postId}-2`);
  assert.deepEqual(selected.qualities, ['1080p']);
  await assert.rejects(e.inspect(`https://x.com/studio/status/${postId}/video/3`), /selected video/);
});

test('X reports unavailable, empty, rate-limited, and unsafe media responses clearly', async () => {
  for (const status of [401, 403, 404]) await assert.rejects(engine(async () => new Response('', { status })).inspect(`https://x.com/a/status/${postId}`), /requires sign-in/);
  await assert.rejects(engine(async () => new Response('', { status: 429 })).inspect(`https://x.com/a/status/${postId}`), /limiting requests/);
  await assert.rejects(engine(async () => json({})).inspect(`https://x.com/a/status/${postId}`), /unavailable/);
  await assert.rejects(engine(async () => json(post([]))).inspect(`https://x.com/a/status/${postId}`), /no downloadable public video/);
  await assert.rejects(engine(async () => json(post([media([{ ...variant(640, 360), url: 'https://evil.test/640x360/video.mp4' }])]))).inspect(`https://x.com/a/status/${postId}`), /no downloadable MP4/);
  await assert.rejects(engine(async () => new Response('x'.repeat(2 * 1024 * 1024 + 1))).inspect(`https://x.com/a/status/${postId}`), /too much post data/);
  assert.equal(safeMediaThumbnail('https://pbs.twimg.com.evil.test/image.jpg'), undefined);
});

test('X downloads stream native MP4 with progress, skip existing files and preserve history', async (t) => {
  const root = await folder(t);
  const bytes = Buffer.from('native mp4 fixture');
  const events = [];
  let streams = 0;
  const e = engine(async (url, options) => {
    if (url.includes('tweet-result')) return json(post());
    assert.equal(new URL(url).hostname, 'video.twimg.com');
    assert.equal(options.redirect, 'error');
    streams++;
    return new Response(bytes, { headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(bytes.length) } });
  });
  const result = await e.download({ folder: root, item: { id: videoId, title: 'X fixture' }, quality: '720p', onEvent: event => events.push(event) });
  assert.deepEqual(await fs.readFile(result.path), bytes);
  assert.equal(events.find(event => event.type === 'progress').total, bytes.length);
  assert.equal(events.find(event => event.type === 'start').quality, '720p');
  assert.equal((await e.download({ folder: root, item: { id: videoId, title: 'X fixture' }, quality: '720p' })).status, 'skipped');
  assert.equal(streams, 1);
  const request = validateRequest({ audio: false, quality: '720p', items: [{ id: videoId, title: 'X fixture', thumbnail: 'https://pbs.twimg.com/test.jpg', url: 'https://evil.test' }] });
  assert.equal(request.items[0].url, undefined);
  assert.throws(() => validateRequest({ ...request, items: [{ id: 'x-../../secret', title: 'Unsafe' }] }), /Invalid/);
  const history = new DownloadHistory(path.join(root, 'history.json'));
  await history.save([{ id: randomUUID(), videoId, title: 'X fixture', folder: root, quality: '720p', audio: false, status: 'saved', path: result.path, thumbnail: request.items[0].thumbnail }]);
  const [restored] = await new DownloadHistory(history.filename).load();
  assert.equal(restored.videoId, videoId);
  assert.equal(restored.thumbnail, request.items[0].thumbnail);
  assert.equal(restored.path, result.path);
});

test('X refreshes expired metadata, tries same-quality encodings, then warns before falling back', async (t) => {
  const root = await folder(t);
  const calls = [], events = [];
  const e = engine(async url => {
    if (url.includes('tweet-result')) return json(post());
    calls.push(url);
    if (url.includes('1280x720')) return new Response('', { status: 403 });
    return new Response('fallback', { headers: { 'Content-Type': 'video/mp4' } });
  });
  await e.download({ folder: root, item: { id: videoId }, quality: '720p', onEvent: event => events.push(event) });
  assert.equal(calls.filter(url => url.includes('1280x720')).length, 2);
  assert.equal(calls.at(-1).includes('640x360'), true);
  assert.match(events.find(event => event.type === 'warning').message, /720p.*360p/);
});

test('cancelling X metadata or a media transfer aborts fetch and cleans partial files', async (t) => {
  const root = await folder(t);
  const controller = new AbortController();
  const pending = engine((url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))).inspect(`https://x.com/a/status/${postId}`, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  const transfer = new AbortController();
  let cancelled = false;
  const e = engine(async url => url.includes('tweet-result') ? json(post()) : new Response(new ReadableStream({ start(c) { c.enqueue(Buffer.from('partial')); }, cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'video/mp4' } }));
  await assert.rejects(e.download({ folder: root, item: { id: videoId }, quality: '720p', signal: transfer.signal, onEvent(event) { if (event.type === 'progress') transfer.abort(); } }), { name: 'AbortError' });
  assert.equal(cancelled, true);
  assert.deepEqual(await fs.readdir(root), []);
});

test('X audio uses the shared encoder to save a real MP3', { skip: spawnSync('ffmpeg', ['-version']).status !== 0 || spawnSync('ffprobe', ['-version']).status !== 0 }, async (t) => {
  const root = await folder(t);
  const fixture = path.join(root, 'fixture.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=640x360:r=10', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.3', '-t', '0.3', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', fixture]);
  const bytes = await fs.readFile(fixture);
  const e = engine(async url => url.includes('tweet-result') ? json(post()) : new Response(bytes, { headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(bytes.length) } }));
  const result = await e.download({ folder: root, item: { id: videoId }, audio: true });
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', result.path], { encoding: 'utf8' }));
  assert.equal(probe.streams[0].codec_name, 'mp3');
});

test('X tries another encoding at the requested resolution before lowering quality', async (t) => {
  const root = await folder(t);
  const high = variant(1280, 720, 3);
  const alternate = { ...variant(1280, 720, 2), url: 'https://video.twimg.com/ext_tw_video/1/pu/vid/1280x720/alternate.mp4' };
  const calls = [];
  const e = engine(async url => {
    if (url.includes('tweet-result')) return json(post([media([variant(640, 360), high, alternate])]));
    calls.push(url);
    if (url === high.url) return new Response('', { status: 403 });
    return new Response('alternate encoding', { headers: { 'Content-Type': 'video/mp4' } });
  });
  const events = [];
  await e.download({ folder: root, item: { id: videoId }, quality: '720p', onEvent: event => events.push(event) });
  assert.deepEqual(calls, [high.url, alternate.url]);
  assert.equal(events.some(event => event.type === 'warning'), false);
});

test('invalid X media responses fail without saving a file', async (t) => {
  const root = await folder(t);
  const e = engine(async url => url.includes('tweet-result') ? json(post()) : new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }));
  await assert.rejects(e.download({ folder: root, item: { id: videoId }, quality: '720p' }), /invalid video stream/);
  assert.deepEqual(await fs.readdir(root), []);
});
