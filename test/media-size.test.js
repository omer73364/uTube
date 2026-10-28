import test from 'node:test';
import assert from 'node:assert/strict';
import { createDownloadEngine } from '../packages/core/engine.js';
import { createInstagramClient } from '../packages/core/instagram.js';
import { createFacebookClient } from '../packages/core/facebook.js';
import { populateMediaSizes } from '../packages/core/media-size.js';
import { product, page as instagramPage, url as instagramURL } from './fixtures/instagram.js';
import { video, page as facebookPage, url as facebookURL } from './fixtures/facebook.js';

for (const provider of ['instagram', 'facebook']) {
  test(`${provider} previews obtain per-quality lengths using HEAD without downloading media`, async () => {
    const calls = [];
    const fetch = async (url, options) => {
      calls.push(options.method || 'GET');
      if (options.method === 'HEAD') {
        assert.equal(options.redirect, 'error');
        return new Response(null, { headers: { 'content-type': 'video/mp4', 'content-length': url.includes('hd.mp4') ? '6000000' : '1000000' } });
      }
      return new Response(provider === 'instagram' ? instagramPage(product()) : facebookPage(video()));
    };
    const engine = createDownloadEngine({ client: {}, [provider + 'Client']: provider === 'instagram' ? createInstagramClient({ fetch }) : createFacebookClient({ fetch }) });
    const preview = await engine.inspect(provider === 'instagram' ? instagramURL : facebookURL);
    assert.equal(preview.sizeEstimates.video[provider === 'instagram' ? '720p' : 'SD'], 1000000);
    if (provider === 'facebook') assert.equal(preview.sizeEstimates.video.HD, 6000000);
    assert.equal(calls.filter(method => method === 'GET').length, 1);
    assert.ok(calls.includes('HEAD'));
  });
}
test('size probes reject unsafe links, invalid responses and missing lengths without blocking previews', async () => {
  for (const headers of [{}, { 'content-length': '-1' }, { 'content-length': '500', 'content-type': 'text/html' }, { 'content-length': '500', 'content-type': 'video/mp4', 'content-encoding': 'gzip' }]) {
    const post = { media: [{}] };
    await populateMediaSizes(post, () => ({ streaming_data: { formats: [{ url: 'https://cdn.fbcdn.net/video.mp4' }] } }), async () => new Response(null, { headers }));
    assert.deepEqual(post.mediaSizes, {});
  }
  await populateMediaSizes({media:[{}]}, () => ({streaming_data:{formats:[{url:'https://evil.test/video.mp4'}]}}), async () => { throw Error('must not request'); });
});
test('cancelling a size lookup stops waiting even if transport ignores abort', async () => {
  const controller = new AbortController();
  const pending = populateMediaSizes({media:[{}]}, () => ({streaming_data:{formats:[{url:'https://cdn.fbcdn.net/video.mp4'}]}}), async () => new Promise(() => {}), {signal:controller.signal});
  controller.abort();
  await assert.rejects(pending, /CANCELLED/);
});
