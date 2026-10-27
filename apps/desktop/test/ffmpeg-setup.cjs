// Explicit network smoke check; run after starting the Forge development server.
if (process.env.UTUBE_FFMPEG_DOWNLOAD_TEST !== '1') {
  console.log('SKIP: set UTUBE_FFMPEG_DOWNLOAD_TEST=1 to test the real upstream download.');
  process.exit(0);
}
const { _electron: electron } = require('playwright');
const { expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-desktop-ffmpeg-'));
  const prefs = path.join(root, 'prefs');
  const media = path.join(root, 'fixture.mp4');
  await fs.mkdir(prefs);
  await fs.writeFile(path.join(prefs, 'settings.json'), JSON.stringify({ folder: root, theme: 'light', language: 'en' }));
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=640x360:r=10', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.3', '-t', '0.3', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', media]);
  const env = { ...process.env, UTUBE_TEST_USER_DATA: prefs, UTUBE_TEST_MEDIA: media };
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
  env.PATH = ''; delete env.UTUBE_FFMPEG; delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', path.resolve(__dirname, '..')], env });
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Not now', exact: true }).click();
    assert.equal((await page.evaluate(() => window.utube.settings())).ffmpeg, false);
    // Start the worker before installing: it must pick up the new path afterwards.
    await page.evaluate(() => window.utube.inspect('https://youtu.be/jNQXAC9IVRw'));
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Download FFmpeg', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cancel setup', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel setup', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Download FFmpeg', exact: true })).toBeEnabled({ timeout: 15000 });
    assert.equal((await page.evaluate(() => window.utube.settings())).ffmpeg, false);
    await page.getByRole('radio', { name: 'العربية', exact: true }).click();
    await expect(page.getByRole('button', { name: 'تنزيل FFmpeg', exact: true })).toBeVisible();
    await page.getByRole('radio', { name: 'English', exact: true }).click();
    await page.getByRole('button', { name: 'Download FFmpeg', exact: true }).click();
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect.poll(async () => (await page.evaluate(() => window.utube.settings())).ffmpeg, { timeout: 180000 }).toBe(true);
    await expect(page.getByRole('heading', { name: 'Download from YouTube or X' })).toBeVisible();
    await page.evaluate(() => window.utube.enqueue({ audio: true, items: [{ id: 'jNQXAC9IVRw', title: 'Downloaded FFmpeg audio' }] }));
    await expect.poll(async () => (await page.evaluate(() => window.utube.jobs()))[0]?.status, { timeout: 20000 }).toBe('saved');
    const [job] = await page.evaluate(() => window.utube.jobs());
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', job.path], { encoding: 'utf8' }));
    assert.equal(probe.streams[0].codec_name, 'mp3');
    const source = path.join(prefs, 'ffmpeg', 'b6.1.1', `${process.platform}-${process.arch}`);
    assert((await fs.readFile(path.join(source, 'LICENSE'), 'utf8')).length > 100);
    await page.reload();
    await expect.poll(async () => (await page.evaluate(() => window.utube.settings())).ffmpeg).toBe(true);
    console.log('PASS: missing system FFmpeg, real setup progress, cancellation/retry, Arabic controls, existing worker MP3 conversion, saved tool after reload.');
  } finally {
    if (app) await app.close();
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
