const jobAction = require('./job-action.cjs');
const { _electron: electron } = require('playwright');
const { expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-persistent-history-'));
  const prefs = path.join(root, 'prefs'); const folder = path.join(root, 'Downloads'); const media = path.join(root, 'fixture.mp4');
  await fs.mkdir(prefs); await fs.mkdir(folder);
  await fs.writeFile(path.join(prefs, 'settings.json'), JSON.stringify({ folder }));
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=640x360:r=10', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.3', '-t', '0.3', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', media]);
  const env = { ...process.env, UTUBE_TEST_USER_DATA: prefs, UTUBE_TEST_MEDIA: media, UTUBE_TEST_DELAY: '700', UTUBE_TEST_FAIL_ONCE: '1' }; delete env.ELECTRON_RUN_AS_NODE;
  const args = [path.resolve(__dirname, '..')]; if (process.env.UTUBE_TEST_NO_SANDBOX === '1') args.unshift('--no-sandbox');
  const launch = () => electron.launch({ executablePath: require('electron'), args, env });
  let app;
  try {
    app = await launch(); let page = await app.firstWindow();
    await page.getByRole('textbox', { name: 'YouTube URL' }).fill('https://youtube.com/playlist?list=PL123');
    await page.getByRole('button', { name: 'Preview link', exact: true }).click();
    await page.getByRole('button', { name: 'Download 2 videos', exact: true }).click();
    await expect.poll(() => page.evaluate(async () => (await window.utube.jobs()).map((job) => job.status)), { timeout: 20000 }).toEqual(['saved', 'failed']);
    await page.evaluate(() => window.utube.enqueue({ audio: false, quality: '360p', items: [{ id: 'jNQXAC9IVRw', title: 'Pending video' }, { id: 'BaW_jenozKc', title: 'Waiting video' }] }));
    await expect.poll(() => page.evaluate(async () => (await window.utube.jobs())[2]?.stage)).toBe('video');
    const original = await page.evaluate(() => window.utube.jobs());
    await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1 }); });
    await app.close(); app = undefined;
    const stored = JSON.parse(await fs.readFile(path.join(prefs, 'downloads.json')));
    expect(stored.jobs.map((job) => job.status)).toEqual(['saved', 'failed', 'cancelled', 'cancelled']);
    expect(stored.jobs.slice(2).every((job) => job.interrupted)).toBe(true);
    delete env.UTUBE_TEST_FAIL_ONCE; env.UTUBE_TEST_DELAY = '0';
    app = await launch(); page = await app.firstWindow();
    await page.getByRole('button', { name: 'Downloads', exact: true }).click();
    await expect(page.getByTestId('job')).toHaveCount(4);
    const restored = await page.evaluate(() => window.utube.jobs());
    expect(restored.map((job) => job.id)).toEqual(original.map((job) => job.id));
    expect(restored[0]).toMatchObject({ path: original[0].path, playlistTitle: 'Weekend collection', createdAt: original[0].createdAt });
    expect(restored.slice(2).every((job) => job.status === 'cancelled' && job.interrupted)).toBe(true);
    await page.getByRole('textbox', { name: 'Search downloads' }).fill('Weekend collection');
    await expect(page.getByTestId('job')).toHaveCount(2);
    await page.getByRole('textbox', { name: 'Search downloads' }).fill('');
    await app.evaluate(({ shell }) => { shell.openPath = async (value) => { globalThis.openedHistoryFile = value; return ''; }; });
    await jobAction(page, `Open ${original[0].title}`);
    expect(await app.evaluate(() => globalThis.openedHistoryFile)).toBe(original[0].path);
    await jobAction(page, `Retry ${original[1].title}`);
    await expect.poll(() => page.evaluate(async () => (await window.utube.jobs())[1]?.status), { timeout: 20000 }).toBe('saved');
    await jobAction(page, 'Retry Pending video');
    await expect.poll(() => page.evaluate(async () => (await window.utube.jobs())[2]?.status), { timeout: 20000 }).toBe('saved');
    await expect(page.getByText('Interrupted', { exact: true })).toHaveCount(1);
    await page.screenshot({ path: '/tmp/utube-persistent-queue.png', fullPage: true });
    await app.close(); app = await launch(); page = await app.firstWindow();
    await page.getByRole('button', { name: 'Downloads', exact: true }).click();
    await expect(page.getByTestId('job')).toHaveCount(4);
    expect((await page.evaluate(() => window.utube.jobs())).map((job) => job.status)).toEqual(['saved', 'saved', 'saved', 'cancelled']);
    console.log('PASS: playlist/video history survives repeated restarts, interrupted work waits for retry, files reopen, playlist search and retries work.');
  } finally {
    if (app) { await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1 }); }).catch(() => {}); await app.close().catch(() => {}); }
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
