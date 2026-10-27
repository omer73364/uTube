import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstagramService } from '../src/instagram.ts';
import { createMediaService } from '../src/media.ts';
import { shareRequests } from '../src/share.ts';
import { code, id, url, video, product, page } from '../../../test/fixtures/instagram.js';
const response = data => ({ status:200, text:async () => page(data) });

test('mobile Instagram routes share links and retry IDs without connecting to YouTube', async () => {
  const unavailable = { inspect:async () => {throw Error('wrong provider');},resolve:async () => {throw Error('wrong provider');} };
  const instagram = createInstagramService(async () => response(product()));
  const media = createMediaService(unavailable,unavailable,instagram);
  const preview = await media.inspect(url);
  assert.equal(preview.provider,'instagram');
  assert.deepEqual(preview.qualities,['720p']);
  const [request] = shareRequests(preview,'mp3','best');
  assert.equal(request.videoId,id);
  assert.equal(request.requestedQuality,'MP3');
  assert.match(request.thumbnail,/cdninstagram/);
  const audio = await media.resolve(id,'MP3','mp3');
  assert.equal(audio.requestedQuality,'MP3');
  assert.ok(audio.candidates[0].audio);
  const plan = await media.resolve(id,'best','video');
  assert.equal(plan.candidates[0].quality,'720p');
});

test('mobile Instagram carousel selection preserves video IDs and refreshes signed URLs', async () => {
  let calls = 0;
  const service = createInstagramService(async () => {calls++;return response(product({carousel_media:[video(360),video(720)]}));});
  const preview = await service.inspect(url);
  const [request] = shareRequests(preview,'video','best',new Set([2]));
  assert.equal(request.videoId,`ig-${code}-2`);
  assert.equal((await service.resolve(request.videoId,'best','video')).candidates[0].quality,'720p');
  assert.equal(calls,2);
});

test('mobile Instagram cancellation and unavailable posts fail clearly', async () => {
  const service = createInstagramService(async () => new Promise(()=>{}));
  const controller = new AbortController();
  const pending = service.inspect(url,controller.signal);controller.abort();
  await assert.rejects(pending,/CANCELLED/);
  await assert.rejects(createInstagramService(async () => ({status:403,text:async () => ''})).inspect(url),/requires sign-in/);
});
