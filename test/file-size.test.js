import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSizeEstimates, selectedSize, summarizeSizes, describeSize, formatFileSize } from '../packages/core/file-size.js';
import { createDownloadEngine } from '../packages/core/engine.js';
import { xVideoMetadata } from '../packages/core/x-metadata.js';
const video = (quality, bytes, extra = {}) => ({ quality_label: quality, content_length: bytes, url: 'https://example.test/video.mp4', has_video: true, has_audio: true, mime_type: 'video/mp4', ...extra });
const audio = bytes => ({ content_length: bytes, url: 'https://example.test/audio.m4a', has_video: false, has_audio: true, mime_type: 'audio/mp4', bitrate: 128000 });
const info = (formats, adaptive_formats = [], duration = 120) => ({ basic_info: { title: 'Video', duration }, streaming_data: { formats, adaptive_formats } });

test('progressive MP4 does not count an extra audio track', () => {
  const sizes = buildSizeEstimates(info([video('360p', '1000000')], [audio(500000)]));
  assert.equal(sizes.video['360p'], 1000000);
  assert.equal(sizes.video.best, 1000000);
});
test('adaptive HD includes both video and companion audio', () => {
  const sizes = buildSizeEstimates(info([video('360p', 1000000)], [video('1080p', 5000000, { has_audio: false }), audio(1000000)]));
  assert.equal(selectedSize(sizes, false, '1080p'), 6000000);
  assert.equal(selectedSize(sizes, false, '360p'), 1000000);
  assert.equal(selectedSize(sizes, false, 'best'), 6000000);
});
test('MP3 predicts encoded output rather than downloaded source size', () => {
  const sizes = buildSizeEstimates(info([video('360p', 30000000)], [], 120));
  assert.equal(selectedSize(sizes, true, '360p'), 2880000);
  assert.equal(selectedSize(sizes, true, '1080p'), 2880000);
});
test('bitrate and duration produce per-quality estimates when byte lengths are absent', () => {
  const sizes = buildSizeEstimates(info([video('360p', undefined, { bitrate: 400000 }), video('720p', undefined, { bitrate: 800000 })], [], 30));
  assert.equal(sizes.video['360p'], 1500000);
  assert.equal(sizes.video['720p'], 3000000);
});
test('average bitrate takes precedence over peak bitrate and known lengths take precedence over estimates', () => {
  assert.equal(buildSizeEstimates(info([video('720p', undefined, { bitrate: 900000, average_bitrate: 400000 })], [], 20)).video['720p'], 1000000);
  assert.equal(buildSizeEstimates(info([video('720p', 12345, { bitrate: 900000 })], [], 20)).video['720p'], 12345);
});
test('adaptive stream sizes remain unknown when audio metadata is absent', () => {
  const sizes = buildSizeEstimates(info([video('1080p', 5000000, { has_audio: false })]));
  assert.equal(sizes.video['1080p'], null);
  assert.equal(selectedSize(sizes, false, 'best'), undefined);
});
test('an unknown highest quality never inherits a lower quality size', () => {
  const sizes = buildSizeEstimates(info([video('360p', 1000000), video('1080p', undefined)], [], 0));
  assert.equal(selectedSize(sizes, false, 'best'), undefined);
  assert.equal(selectedSize(sizes, false, '1080p'), undefined);
  assert.equal(selectedSize(sizes, false, '360p'), 1000000);
});
test('carousel fallback follows the highest available lower resolution, including SD/HD', () => {
  assert.equal(selectedSize({ video: { '360p': 10, '720p': 20 } }, false, '1080p'), 20);
  assert.equal(selectedSize({ video: { SD: 10, HD: 20 } }, false, '1080p'), 20);
  assert.equal(selectedSize({ video: { '360p': 10, '720p': null } }, false, '1080p'), undefined);
  assert.equal(selectedSize({ video: { '720p': 20 } }, false, '360p'), undefined);
});
test('metadata does not fabricate sizes from resolution alone or malformed values', () => {
  for (const length of [undefined, 0, -10, 'invalid', Infinity, Number.MAX_SAFE_INTEGER * 2]) {
    const sizes = buildSizeEstimates(info([video('720p', length)], [], 0));
    assert.equal(selectedSize(sizes, false, '720p'), undefined);
    assert.equal(sizes.mp3, undefined);
  }
});
test('selection totals distinguish unknown files, update with quality, and handle empty selections', () => {
  const one = { sizeEstimates: { video: { '360p': 1000000, '720p': 2000000 } } };
  const two = { sizeEstimates: { video: { '360p': 3000000, '720p': 4000000 } } };
  assert.deepEqual(summarizeSizes([one, two], false, '720p'), { bytes: 6000000, known: 2, count: 2 });
  assert.deepEqual(summarizeSizes([one], false, '360p'), { bytes: 1000000, known: 1, count: 1 });
  const partial = summarizeSizes([one, {}], false, '720p');
  assert.deepEqual(partial, { bytes: 2000000, known: 1, count: 2 });
  assert.match(describeSize(partial).value, /\+ \?/);
  assert.match(describeSize(partial).help, /1 of 2/);
  assert.equal(describeSize(summarizeSizes([{}], false, '720p')).value, 'Size unavailable');
  assert.match(describeSize(summarizeSizes([], false, '720p')).value, /Select videos/);
});
test('size output uses decimal units, localized numbers and safe unknown states', () => {
  assert.equal(formatFileSize(12500000), '12.5 MB');
  assert.equal(formatFileSize(1500000000), '1.5 GB');
  assert.equal(formatFileSize(NaN), undefined);
  const arabic = describeSize({ bytes: 12500000, known: 1, count: 1 }, 'ar');
  assert.equal(arabic.label, 'حجم الملف التقريبي');
  assert.ok(arabic.value.includes(new Intl.NumberFormat('ar', { maximumFractionDigits: 1 }).format(12.5)));
  assert.match(arabic.value, /MB/);
});
test('desktop YouTube previews carry estimates without deciphering or downloading media', async () => {
  const format = video('720p', 5000000, { decipher() { throw Error('must not decipher'); } });
  const engine = createDownloadEngine({ client: { getInfo: async () => info([format]) } });
  const preview = await engine.inspect('https://youtu.be/jNQXAC9IVRw');
  assert.equal(preview.sizeEstimates.video['720p'], 5000000);
  assert.equal(preview.sizeEstimates.mp3, 2880000);
});
test('desktop multi-video previews retain per-item size metadata for selection totals', async () => {
  const postId = '1577855540407197696';
  const post = { data: { id_str: postId, user: { name: 'Studio' } }, media: [400000, 800000].map(bitrate => ({ video_info: { duration_millis: 10000, variants: [{ content_type: 'video/mp4', bitrate, url: 'https://video.twimg.com/ext_tw_video/vid/1280x720/video.mp4' }] } })) };
  const engine = createDownloadEngine({ client: {}, xClient: { getPost: async () => post, videoInfo: xVideoMetadata } });
  const preview = await engine.inspect(`https://x.com/studio/status/${postId}`);
  assert.equal(preview.type, 'playlist');
  assert.equal(summarizeSizes(preview.items, false, '720p').bytes, 1500000);
  assert.equal(summarizeSizes([preview.items[1]], false, '720p').bytes, 1000000);
});
