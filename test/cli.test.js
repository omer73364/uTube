import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ReadableStream } from 'node:stream/web';
import { getVideoOrListID, specialRemover } from '../functions/heperFunctions.js';
import { selectFormat, saveStream, downloadVideo } from '../functions/download.js';

const id = 'BaW_jenozKc';
test('URL parsing handles supported forms and rejects unrelated hosts', () => {
  for (const url of [`youtu.be/${id}`, `https://m.youtube.com/watch?v=${id}&list=PL123`, `https://youtube.com/shorts/${id}`, `https://youtube.com/embed/${id}`, `https://youtube.com/live/${id}`]) {
    assert.deepEqual(getVideoOrListID(url), { type: 'video', id });
  }
  assert.deepEqual(getVideoOrListID('https://youtube.com/playlist?list=PL123'), { type: 'list', id: 'PL123' });
  for (const url of ['invalid', 'https://youtube.com.evil.test/watch?v='+id, 'https://youtube.com/watch?v=bad']) assert.throws(() => getVideoOrListID(url));
});
test('filenames cannot escape the destination and support Windows reserved names', () => {
  assert.equal(specialRemover('../a/b\\c:*?'), '.._a_b_c___');
  assert.equal(specialRemover('..'), 'video');
  assert.equal(specialRemover('CON'), '_CON');
});
test('selects requested quality and falls back without recursion', () => {
  const low = { url: 'https://example.com/video', itag: 18, has_video: true, has_audio: true, quality_label: '360p', mime_type: 'video/mp4', height: 360 };
  const high = { ...low, itag: 137, has_audio: false, quality_label: '1080p', height: 1080 };
  const info = { streaming_data: { formats: [low], adaptive_formats: [high] } };
  assert.equal(selectFormat(info, '1080p'), high);
  assert.equal(selectFormat(info, '720p'), low);
  assert.throws(() => selectFormat({}, '360p'), /No downloadable/);
});
test('failed streams remove partial files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-test-'));
  try {
    const filename = path.join(dir, 'partial.mp4');
    const stream = new ReadableStream({ start(controller) { controller.enqueue(Buffer.from('partial')); }, pull(controller) { controller.error(new Error('connection lost')); } });
    await assert.rejects(saveStream(stream, filename), /connection lost/);
    await assert.rejects(fs.access(filename));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('download waits for completion, writes a safe filename, and cleans temporary files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-download-'));
  const previous = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = dir;
  await fs.mkdir(path.join(dir, 'utube-cli'));
  await fs.writeFile(path.join(dir, 'utube-cli/settings.json'), JSON.stringify({ downloadFolder: dir }));
  global.progressBar = { start() {}, update() {}, stop() {} };
  const info = {
    streaming_data: { formats: [{ url: 'https://example.com/video', itag: 18, has_video: true, has_audio: true, quality_label: '360p', mime_type: 'video/mp4' }] },
    download: async () => new ReadableStream({ start(controller) { controller.enqueue(Buffer.from('video data')); controller.close(); } }),
  };
  try {
    await downloadVideo({ id, title: '../unsafe/name' }, undefined, '360p', info);
    const entries = await fs.readdir(dir);
    assert.equal(entries.filter((entry) => entry.startsWith('.utube-')).length, 0);
    assert.equal(await fs.readFile(path.join(dir, `.._unsafe_name [${id}].mp4`), 'utf8'), 'video data');
  } finally {
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = previous;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test('local CLI commands run offline and invalid arguments fail', () => {
  const run = (...args) => spawnSync(process.execPath, ['index.js', ...args], { encoding: 'utf8', timeout: 10000 });
  assert.equal(run('-v').status, 0);
  assert.match(run('--help').stdout, /Usage: utube/);
  assert.equal(run('-u').status, 1);
  assert.equal(run('--unknown').status, 1);
  assert.equal(run('-u', 'not-youtube').status, 1);
});

test('playlist retrieval includes continuation pages and filters inaccessible items', async () => {
  const { getListData } = await import('../functions/getData.js');
  const original = global.youtube;
  global.youtube = { getPlaylist: async () => ({
    info: { title: 'Playlist' }, items: [{ id: 'first' }, { title: 'Deleted video' }], has_continuation: true,
    getContinuation: async () => ({ items: [{ id: 'second' }], has_continuation: false }),
  }) };
  try {
    const data = await getListData('PL123');
    assert.deepEqual(data.items.map((item) => item.id), ['first', 'second']);
    assert.equal(data.info.title, 'Playlist');
  } finally { global.youtube = original; }
});

test('settings persist outside the installed package', async () => {
  const { getSetting, setDownloadFolder } = await import('../functions/heperFunctions.js');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-config-'));
  const previous = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = dir;
  try {
    setDownloadFolder('./downloads with spaces');
    assert.equal(getSetting('downloadFolder'), path.resolve('downloads with spaces'));
    assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'utube-cli/settings.json'), 'utf8')).downloadFolder, path.resolve('downloads with spaces'));
  } finally {
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = previous;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
