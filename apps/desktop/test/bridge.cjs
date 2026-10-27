const { _electron: electron } = require('playwright');
const { expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-desktop-test-'));
  const prefs = path.join(root, 'prefs');
  const media = path.join(root, 'fixture.mp4');
  await fs.mkdir(prefs);
  await fs.writeFile(path.join(prefs, 'settings.json'), JSON.stringify({ folder: root }));
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=640x360:r=10', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-t', '1', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', media]);
  const env = { ...process.env, UTUBE_TEST_USER_DATA: prefs, UTUBE_TEST_MEDIA: media, UTUBE_TEST_DELAY: '150' };
  delete env.ELECTRON_RUN_AS_NODE;
  const args = [path.resolve(__dirname, '..')];
  if (process.env.UTUBE_TEST_NO_SANDBOX === '1') args.unshift('--no-sandbox');
  const app = await electron.launch({ executablePath: require('electron'), args, env });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: 'Download from YouTube or X' })).toBeVisible();
    const isolated = await page.evaluate(() => ({ require: typeof window.require, process: typeof window.process }));
    assert.deepEqual(isolated, { require: 'undefined', process: 'undefined' });
    const preview = await page.evaluate(() => window.utube.inspect('https://youtu.be/jNQXAC9IVRw'));
    assert.deepEqual(preview.qualities, ['360p']);
    await page.evaluate(() => window.utube.enqueue({ audio: true, items: [{ id: 'jNQXAC9IVRw', title: 'Worker audio' }] }));
    await expect.poll(() => page.evaluate(async () => (await window.utube.jobs())[0]?.status), { timeout: 20000 }).toBe('saved');
    const [job] = await page.evaluate(() => window.utube.jobs());
    assert.equal(job.status, 'saved', job.error);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', job.path], { encoding: 'utf8' }));
    assert.equal(probe.streams[0].codec_name, 'mp3');
    const [id] = await page.evaluate(() => window.utube.enqueue({ audio: false, quality: '360p', items: [{ id: 'BaW_jenozKc', title: 'Cancel this' }] }));
    await page.evaluate((id) => window.utube.cancel(id), id);
    await expect.poll(() => page.evaluate(async () => (await window.utube.jobs())[1]?.status)).toBe('cancelled');
    await assert.rejects(page.evaluate((id) => window.utube.openFile(id), id), /not ready to open/);
    console.log('PASS: renderer isolation, worker preview, real MP3 conversion, cancellation.');
  } finally {
    const page = app.windows()[0];
    if (page && !page.isClosed()) await page.evaluate(async () => {
      for (const job of await window.utube.jobs()) if (['queued', 'running'].includes(job.status)) await window.utube.cancel(job.id);
    }).catch(() => {});
    await app.close();
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
