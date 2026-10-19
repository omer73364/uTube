import { getYouTubeClient, setYouTubeClient } from "../apps/cli/functions/service.js";
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { downloadVideo, selectFormat, selectAudioFormat } from '../apps/cli/functions/download.js';

const available = ['ffmpeg', 'ffprobe'].every((command) => spawnSync(command, ['-version'], { encoding: 'utf8' }).status === 0);
let root;
let audioBytes;
let combinedBytes;
const originalConfig = process.env.XDG_CONFIG_HOME;
const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 30000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
};
const probe = (filename) => JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', filename]));
const audio = { itag: 140, url: 'https://example.test/audio', has_audio: true, has_video: false, is_original: true, mime_type: 'audio/mp4', bitrate: 128000 };
const mockInfo = (formats, contents) => ({
  streaming_data: { adaptive_formats: formats },
  basic_info: { title: 'Test media' },
  chooseFormat: () => audio,
  download: async ({ itag, range }) => new ReadableStream({ start(controller) {
    const bytes = contents[itag];
    controller.enqueue(range ? bytes.subarray(range.start, range.end + 1) : bytes);
    controller.close();
  } }),
});

before(async () => {
  if (!available) return;
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-media-'));
  process.env.XDG_CONFIG_HOME = root;
  await fs.mkdir(path.join(root, 'utube-cli'));
  await fs.writeFile(path.join(root, 'utube-cli/settings.json'), JSON.stringify({ downloadFolder: root }));
  run('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.3', '-c:a', 'aac', path.join(root, 'source.m4a')]);
  audioBytes = await fs.readFile(path.join(root, 'source.m4a'));
  run('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=5', '-i', path.join(root, 'source.m4a'), '-t', '0.3', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'copy', path.join(root, 'combined.mp4')]);
  combinedBytes = await fs.readFile(path.join(root, 'combined.mp4'));
});
after(async () => {
  if (originalConfig === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = originalConfig;
  if (root) await fs.rm(root, { recursive: true, force: true });
});

test('audio selection prefers original audio-only streams over combined video', () => {
  const dubbed = { ...audio, itag: 141, is_original: false, bitrate: 256000 };
  const combined = { ...audio, itag: 18, has_video: true, bitrate: 1000000 };
  assert.equal(selectAudioFormat({ streaming_data: { formats: [combined], adaptive_formats: [dubbed, audio] } }), audio);
  assert.equal(selectAudioFormat({ streaming_data: { formats: [combined] } }), combined);
  assert.throws(() => selectAudioFormat({}), /No downloadable audio/);
});

test('720p requests can use 720p60 without falling back to 360p', () => {
  const high = { url: 'https://example.test/video', itag: 298, mime_type: 'video/mp4', has_video: true, quality_label: '720p60', height: 720 };
  const low = { ...high, itag: 18, quality_label: '360p', height: 360, has_audio: true };
  assert.equal(selectFormat({ streaming_data: { formats: [low], adaptive_formats: [high] } }, '720p'), high);
});

for (const [height, width] of [[480, 854], [720, 1280], [1080, 1920]]) {
  test(`downloads and merges ${height}p video with audio`, { skip: !available }, async () => {
    const filename = path.join(root, `${height}-source.mp4`);
    run('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `color=c=blue:s=${width}x${height}:r=5`, '-t', '0.4', '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', filename]);
    const videoBytes = await fs.readFile(filename);
    const video = { itag: height, url: 'https://example.test/video', mime_type: 'video/mp4', has_video: true, has_audio: false, height, quality_label: `${height}p`, content_length: videoBytes.length };
    const info = mockInfo([video, audio], { [height]: videoBytes, 140: audioBytes });
    const item = { id: `hd${height}`, title: `Video ${height}p` };
    assert.equal(await downloadVideo(item, undefined, `${height}p`, info), 'saved');
    const result = probe(path.join(root, `${item.title} [${item.id}].mp4`));
    assert.equal(result.streams.find((stream) => stream.codec_type === 'video').height, height);
    assert.ok(result.streams.some((stream) => stream.codec_type === 'audio'));
    assert.equal(await downloadVideo(item, undefined, `${height}p`, info), 'skipped');
  });
}

test('creates a real MP3 with title metadata alongside an existing MP4', { skip: !available }, async () => {
  const item = { id: 'audio-test', title: 'Test song' };
  await fs.mkdir(path.join(root, 'Audio playlist'));
  await fs.writeFile(path.join(root, 'Audio playlist', 'Test song [audio-test].mp4'), 'existing video');
  const info = mockInfo([{ ...audio, content_length: audioBytes.length }], { 140: audioBytes });
  assert.equal(await downloadVideo(item, 'Audio playlist', undefined, info, true), 'saved');
  const result = probe(path.join(root, 'Audio playlist', 'Test song [audio-test].mp3'));
  assert.equal(result.streams.length, 1);
  assert.equal(result.streams[0].codec_name, 'mp3');
  assert.equal(result.format.tags.title, 'Test song');
  assert.ok(Number(result.format.duration) > 0);
  assert.equal(await fs.readFile(path.join(root, 'Audio playlist', 'Test song [audio-test].mp4'), 'utf8'), 'existing video');
  assert.equal(await downloadVideo(item, 'Audio playlist', undefined, info, true), 'skipped');
});

test('a failed MP3 conversion removes temporary files and leaves no target', { skip: !available }, async () => {
  const info = mockInfo([audio], { 140: Buffer.from('invalid audio') });
  await assert.rejects(downloadVideo({ id: 'broken', title: 'Broken audio' }, undefined, undefined, info, true), /FFmpeg failed/);
  await assert.rejects(fs.access(path.join(root, 'Broken audio [broken].mp3')));
  assert.equal((await fs.readdir(root)).filter((name) => name.startsWith('.utube-')).length, 0);
});


test('audio mode survives client fallback and extracts MP3 from a combined stream', { skip: !available }, async () => {
  const original = getYouTubeClient();
  const clients = [];
  const combined = { ...audio, itag: 18, has_video: true, mime_type: 'video/mp4', content_length: combinedBytes.length };
  const good = mockInfo([combined], { 18: combinedBytes });
  const rejected = mockInfo([audio], {});
  rejected.download = async () => { const error = new Error('rejected'); error.info = { response: { status: 403 } }; throw error; };
  setYouTubeClient({ getInfo: async (id, { client }) => { clients.push(client); return client === 'ANDROID' ? good : rejected; } });
  try {
    await downloadVideo({ id: 'fallback', title: 'Fallback audio' }, undefined, undefined, rejected, true);
    assert.deepEqual(clients, ['IOS', 'ANDROID']);
    const result = probe(path.join(root, 'Fallback audio [fallback].mp3'));
    assert.equal(result.streams.length, 1);
    assert.equal(result.streams[0].codec_name, 'mp3');
  } finally { setYouTubeClient(original); }
});

test('missing FFmpeg fails audio mode before any media is downloaded', { skip: !available }, async () => {
  const previousPath = process.env.PATH;
  let downloaded = false;
  const info = mockInfo([audio], { 140: audioBytes });
  info.download = async () => { downloaded = true; throw new Error('should not download'); };
  process.env.PATH = root;
  try {
    await assert.rejects(downloadVideo({ id: 'missing', title: 'Missing encoder' }, undefined, undefined, info, true), /requires FFmpeg/);
    assert.equal(downloaded, false);
    assert.equal((await fs.readdir(root)).filter((name) => name.startsWith('.utube-')).length, 0);
  } finally { process.env.PATH = previousPath; }
});
