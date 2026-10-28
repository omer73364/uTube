import test from 'node:test';
import assert from 'node:assert/strict';
import { createXService } from '../src/x.ts';
import { createMediaService } from '../src/media.ts';
import { shareRequests } from '../src/share.ts';
import { videoId } from '../src/domain.ts';

const postId = '1577855540407197696';
const id = `x-${postId}-1`;
const variant = (width, height, bitrate = 1, suffix = '') => ({ content_type: 'video/mp4', bitrate, url: `https://video.twimg.com/ext_tw_video/1/pu/vid/${width}x${height}/video${suffix}.mp4` });
const media = (variants = [variant(320, 400), variant(480, 600, 2), variant(720, 900, 3)]) => ({ type: 'video', media_url_https: 'https://pbs.twimg.com/media/test.jpg', video_info: { duration_millis: 1000, variants } });
const post = (mediaDetails = [media()]) => ({ id_str: postId, text: 'A public video https://t.co/abc', user: { name: 'Studio' }, mediaDetails });
const response = data => ({ status: 200, text: async () => JSON.stringify(data) });
const url = `https://x.com/studio/status/${postId}`;

test('mobile routes X and Twitter links and encoded retry IDs before initializing YouTube', async () => {
  const calls = [];
  const youtube = { inspect: async () => { calls.push('youtube-inspect'); }, resolve: async () => { calls.push('youtube-resolve'); } };
  const service = createMediaService(youtube, createXService(async () => { calls.push('x'); return response(post()); }));
  assert.equal((await service.inspect(url)).provider, 'x');
  assert.equal((await service.inspect(url.replace('x.com', 'twitter.com'))).id, id);
  assert.equal((await service.resolve(id, '720p', 'video')).videoId, id);
  assert.deepEqual(calls, ['x', 'x', 'x']);
  await service.inspect('https://youtu.be/jNQXAC9IVRw');
  await service.resolve('jNQXAC9IVRw', '360p', 'video');
  assert.deepEqual(calls.slice(-2), ['youtube-inspect', 'youtube-resolve']);
  assert.equal(videoId(url), id);
  await assert.rejects(async () => service.inspect(`https://x.com.evil.test/a/status/${postId}`), /valid YouTube, X, Instagram, or Facebook/);
});

test('mobile X preview uses real portrait resolutions and keeps thumbnails in queue requests', async () => {
  const service = createXService(async requestURL => {
    const request = new URL(requestURL);
    assert.equal(request.hostname, 'cdn.syndication.twimg.com');
    assert.ok(request.searchParams.get('token'));
    return response(post());
  });
  const preview = await service.inspect(url);
  assert.deepEqual(preview.qualities, ['720p', '480p', '320p']);
  assert.equal(preview.audioAvailable, true);
  assert.equal(preview.author, 'Studio');
  const [request] = shareRequests(preview, 'video', '720p');
  assert.equal(request.videoId, id);
  assert.equal(request.thumbnail, 'https://pbs.twimg.com/media/test.jpg');
  assert.equal(request.requestedQuality, '720p');
  assert.equal(shareRequests(preview, 'mp3', '720p')[0].requestedQuality, 'MP3');
});

test('mobile selects individual videos or a subset from multi-video X posts', async () => {
  const service = createXService(async () => response(post([{ type: 'photo' }, media(), media([variant(1920, 1080)])])));
  const preview = await service.inspect(url);
  assert.equal(preview.kind, 'playlist');
  assert.deepEqual(preview.qualities, ['1080p', '720p', '480p', '320p']);
  const [request] = shareRequests(preview, 'mp3', '1080p', new Set([2]));
  assert.equal(request.videoId, `x-${postId}-2`);
  assert.equal(request.playlistIndex, 2);
  assert.equal(request.requestedQuality, 'MP3');
  assert.equal(request.thumbnail, 'https://pbs.twimg.com/media/test.jpg');
  assert.equal((await service.inspect(`${url}/video/2`)).id, `x-${postId}-2`);
  await assert.rejects(service.inspect(`${url}/video/3`), /selected video/);
});

test('native X plans exhaust same-quality encodings before lower qualities and resolve fresh links', async () => {
  let calls = 0;
  const service = createXService(async () => response(post([media([variant(640, 360), variant(1920, 1080, 4), variant(1280, 720, 2), variant(1280, 720, 3, `-fresh-${++calls}`)])])));
  await service.inspect(url);
  const plan = await service.resolve(id, '720p', 'video');
  assert.deepEqual(plan.candidates.map(c => c.quality), ['720p', '720p', '360p']);
  assert.match(plan.candidates[0].video.url, /fresh-2/);
  assert.equal(plan.candidates[0].audio, undefined);
  assert.equal(plan.candidates[0].video.size, 0);
  const best = await service.resolve(id, 'best', 'video');
  assert.equal(best.candidates[0].quality, '1080p');
  const mp3 = await service.resolve(id, '720p', 'mp3');
  assert.equal(mp3.requestedQuality, 'MP3');
  assert.ok(mp3.candidates.every(c => c.audio && !c.video && c.quality === 'MP3'));
  await assert.rejects(service.resolve(id, '144p', 'video'), /NO_FORMATS/);
});

test('mobile rejects unavailable, malformed, oversized, and unsafe X metadata', async () => {
  for (const status of [401, 403, 404]) await assert.rejects(createXService(async () => ({ status })).inspect(url), /requires sign-in/);
  await assert.rejects(createXService(async () => ({ status: 429 })).inspect(url), /limiting requests/);
  for (const data of [{}, post([]), post([media([null, { ...variant(640, 360), url: 'https://evil.test/video.mp4' }])])]) await assert.rejects(createXService(async () => response(data)).inspect(url));
  await assert.rejects(createXService(async () => ({ status: 200, text: async () => '{' })).inspect(url), /unavailable/);
  await assert.rejects(createXService(async () => ({ status: 200, text: async () => 'x'.repeat(2 * 1024 * 1024 + 1) })).inspect(url), /too much/);
});

test('mobile X lookup and background preparation cancel even when transport ignores abort', async () => {
  for (const operation of ['inspect', 'resolve']) {
    const controller = new AbortController();
    let transportSignal;
    const service = createXService((_, signal) => { transportSignal = signal; return new Promise(() => {}); });
    const pending = operation === 'inspect' ? service.inspect(url, controller.signal) : service.resolve(id, '720p', 'video', controller.signal);
    controller.abort();
    await assert.rejects(pending, /CANCELLED/);
    assert.equal(transportSignal.aborted, true);
  }
});

test('mobile X previews carry bitrate size estimates for single videos and selected carousel items', async () => {
  const service = createXService(async () => response(post([
    media([variant(1280, 720, 800000)]), media([variant(640, 360, 400000)]),
  ])));
  const preview = await service.inspect(url);
  assert.equal(preview.items[0].sizeEstimates.video['720p'], 100000);
  assert.equal(preview.items[1].sizeEstimates.video['360p'], 50000);
  const single = await service.inspect(`${url}/video/2`);
  assert.equal(single.sizeEstimates.video['360p'], 50000);
  assert.equal(single.sizeEstimates.mp3, 24000);
});
