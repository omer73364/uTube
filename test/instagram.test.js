import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseMediaURL, validMediaID, isInstagramVideoID, safeMediaThumbnail } from '../packages/core/media-source.js';
import { instagramMediaURL, instagramPostData, instagramMediaID, fetchInstagramPost } from '../packages/core/instagram-metadata.js';
import { createInstagramClient } from '../packages/core/instagram.js';
import { createDownloadEngine } from '../packages/core/engine.js';
import { validateRequest } from '../apps/desktop/src/main/validation.mjs';
import { code, id, url, video, product, page } from './fixtures/instagram.js';
const engine = fetch => createDownloadEngine({ client: { getInfo() { throw Error('Must not initialize YouTube'); } }, instagramClient: createInstagramClient({ fetch }) });

test('Instagram parses Reel and post aliases and rejects impersonated domains and unsupported links', () => {
  for (const host of ['instagram.com','www.instagram.com','m.instagram.com']) for (const kind of ['reel','reels','p','tv']) {
    assert.equal(parseMediaURL(`https://${host}/${kind}/${code}/?igsh=abc`).id, id);
  }
  for (const value of ['https://instagram.com.evil.test/reel/abcdef/', 'https://user@instagram.com/reel/abcdef/', 'https://instagram.com:444/reel/abcdef/', 'https://instagram.com/stories/user/123/', 'https://instagram.com/username/', 'https://instagram.com/reel/abc/extra']) assert.throws(() => parseMediaURL(value), /valid/);
  assert.equal(validMediaID(id), true);
  assert.equal(isInstagramVideoID('ig-abcdef-0'), false);
  assert.equal(instagramMediaURL('https://fbcdn.net.evil.test/video.mp4'), null);
  assert.equal(instagramMediaURL('https://user@cdn.cdninstagram.com/video.mp4'), null);
  assert.equal(instagramMediaURL('https://cdn.cdninstagram.com/video.m3u8'), null);
  assert.equal(safeMediaThumbnail('https://cdn.cdninstagram.com.evil.test/image.jpg'), undefined);
  assert.equal(instagramMediaID('AAAABA'), '64');
});

test('Instagram previews embedded JSON, original dimensions, thumbnails and video carousels', async () => {
  const e = engine(async () => new Response(page(product())));
  const preview = await e.inspect(url);
  assert.equal(preview.provider, 'instagram');
  assert.deepEqual(preview.qualities, ['720p']);
  assert.equal(preview.id, id);
  assert.equal(preview.author, 'studio');
  assert.match(preview.thumbnail, /cdninstagram.com/);
  const carousel = engine(async () => new Response(page(product({ carousel_media: [{ media_type: 1 }, video(360), video(720)] }))));
  const list = await carousel.inspect(url);
  assert.equal(list.type, 'playlist');
  assert.deepEqual(list.items.map(item => item.id), [id, `ig-${code}-2`]);
  assert.deepEqual(list.qualities, ['360p', '720p']);
  assert.equal(validateRequest({ audio:false, quality:'720p', items:list.items }).items.length, 2);
  assert.throws(() => instagramPostData(code, product({ code:'unrelated' })), /unavailable/);
});

test('Instagram public GraphQL fallback uses the page token and exact media identifier', async () => {
  const calls = [];
  const post = await fetchInstagramPost(code, async (target, options) => {
    calls.push(target);
    if (calls.length === 1) return { status:200, text:async () => '<script>["LSD",[],{"token":"public-token"}]</script>' };
    const body = new URLSearchParams(options.body);
    assert.equal(options.method, 'POST');
    assert.equal(body.get('lsd'), 'public-token');
    assert.equal(JSON.parse(body.get('variables')).media_id, instagramMediaID(code));
    return { status:200, text:async () => JSON.stringify({ data:product() }) };
  });
  assert.equal(post.media.length, 1);
  assert.equal(calls[1], 'https://www.instagram.com/api/graphql');
});

test('Instagram reports login, rate limits, malformed metadata, unsafe streams and oversized pages', async () => {
  for (const status of [401,403,404]) await assert.rejects(engine(async () => new Response('', {status})).inspect(url), /requires sign-in/);
  await assert.rejects(engine(async () => new Response('', {status:429})).inspect(url), /limiting/);
  await assert.rejects(engine(async () => new Response('<html>Sign in</html>')).inspect(url), /requires sign-in/);
  await assert.rejects(engine(async () => new Response(page(product({video_versions:[{url:'https://evil.test/video.mp4'}]})))).inspect(url), /no downloadable MP4/);
  await assert.rejects(engine(async () => new Response('x'.repeat(8*1024*1024+1))).inspect(url), /too much/);
});

test('Instagram download refreshes links, streams without FFmpeg, persists safe metadata and cancels', async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(),'utube-ig-'));
  t.after(() => fs.rm(folder,{recursive:true,force:true}));
  let lookups = 0;
  const bytes = Buffer.from('MP4 fixture');
  const e = engine(async (target, options) => {
    assert.equal(options.redirect, 'error');
    if (target.includes('instagram.com/p/')) {lookups++; return new Response(page(product()));}
    return new Response(bytes,{headers:{'Content-Type':'video/mp4','Content-Length':String(bytes.length)}});
  });
  await e.inspect(url);
  const result = await e.download({folder,item:{id,title:'Instagram fixture'},quality:'720p'});
  assert.deepEqual(await fs.readFile(result.path),bytes);
  assert.equal(lookups,2);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(e.inspect(url,{signal:controller.signal}), /abort/i);
});
