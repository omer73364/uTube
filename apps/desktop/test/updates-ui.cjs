// Renderer integration: simulated update events, no real installers or network.
const { _electron: electron } = require('playwright');
const { expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-updates-ui-'));
  const url = process.env.UTUBE_RENDERER_URL || 'http://127.0.0.1:4184/';
  await fs.writeFile(path.join(root, 'preload.cjs'), `
    const { contextBridge } = require('electron');
    let prefs = { language: 'en', theme: 'light', resolvedTheme: 'light', folder: '/Downloads/uTube', version: '2.5.0', ffmpeg: true };
    let state = { phase: 'available', loaded: 0, total: 100, statusVerified: true,
      services: [{ provider: 'instagram', state: 'unavailable', message: { en: 'Instagram downloads are temporarily unavailable.', ar: 'تنزيلات إنستغرام غير متاحة مؤقتًا.' } }],
      release: { version: '2.6.0', kind: 'dmg', notes: { en: 'Restores Instagram downloads.', ar: 'استعادة تنزيلات إنستغرام.' } } };
    let listener = () => {}, jobsListener = () => {}, installed;
    let jobs = [{ id: 'held', videoId: 'ig-ABCDE-1', title: 'Held video', status: 'queued', holdReason: 'instagram', loaded: 0, audio: false }];
    contextBridge.exposeInMainWorld('__updatesTest', { installed: () => installed, phase: phase => { state = { ...state, phase }; listener(state); }, running: active => { jobs = active ? [{ id: 'running', videoId: 'jNQXAC9IVRw', title: 'Current download', status: 'running', loaded: 1, audio: false }] : [{ id: 'held', videoId: 'ig-ABCDE-1', title: 'Held video', status: 'queued', loaded: 0, audio: false }]; jobsListener(jobs); } });
    contextBridge.exposeInMainWorld('utube', {
      settings: async () => prefs, jobs: async () => jobs,
      preferences: async patch => { prefs = { ...prefs, ...patch }; return prefs; },
      onJobs: fn => { jobsListener = fn; return () => {}; }, onTheme: () => () => {}, onHistoryError: () => () => {},
      updates: async () => state, onUpdates: fn => { listener = fn; return () => {}; },
      checkUpdates: async () => state,
      downloadUpdate: async () => { state = { ...state, phase: 'downloading', loaded: 50 }; listener(state); return state; },
      cancelUpdate: async () => { state = { ...state, phase: 'available' }; listener(state); },
      installUpdate: async interrupt => { installed = interrupt; state = { ...state, phase: 'waiting' }; listener(state); },
      openFolder: async () => {},
    });
  `);
  await fs.writeFile(path.join(root, 'main.cjs'), `
    const { app, BrowserWindow } = require('electron');
    app.whenReady().then(() => new BrowserWindow({ width: 1180, height: 850, webPreferences: { preload: ${JSON.stringify(path.join(root, 'preload.cjs'))}, contextIsolation: true, sandbox: false } }).loadURL(${JSON.stringify(url)}));
  `);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', path.join(root, 'main.cjs')], env });
  try {
    const page = await app.firstWindow();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await expect(page.getByText('Instagram downloads are temporarily unavailable.')).toBeVisible();
    await page.getByRole('button', { name: 'Download update', exact: true }).click();
    await expect(page.getByRole('progressbar', { name: 'Downloading update…' })).toHaveAttribute('value', '50');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Download update', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Check for updates', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Check for updates', exact: true })).toBeVisible();
    const order = await page.locator('.settings-card').innerText();
    expect(order.indexOf('App updates')).toBeLessThan(order.indexOf('About'));
    expect(order.indexOf('App updates')).toBeGreaterThan(order.indexOf('FFmpeg'));
    await page.evaluate(() => window.__updatesTest.phase('ready'));
    await page.getByRole('button', { name: 'Open installer', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stop download and install', exact: true })).toHaveCount(0);
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Open installer', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.screenshot({ path: '/tmp/utube-update-settings.png', fullPage: true });
    await page.evaluate(() => window.__updatesTest.running(true));
    await page.getByRole('button', { name: 'Open installer', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stop download and install', exact: true })).toBeVisible();
    await page.evaluate(() => window.__updatesTest.running(false));
    await expect(page.getByRole('button', { name: 'Stop download and install', exact: true })).toHaveCount(0);
    await page.evaluate(() => window.__updatesTest.running(true));
    await page.getByRole('button', { name: 'Install after current download', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__updatesTest.installed())).toBe(false);
    await expect(page.getByText(/Waiting for the current download/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('radio', { name: 'العربية', exact: true }).click();
    await expect(page.getByRole('heading', { name: /تحديثات التطبيق/ })).toBeVisible();
    await expect(page.getByText('تنزيلات إنستغرام غير متاحة مؤقتًا.')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.screenshot({ path: '/tmp/utube-update-settings-ar.png', fullPage: true });
    expect(errors).toEqual([]);
    console.log('PASS: update banner, download progress, cancellation, modal focus/Escape, install drain request, service notices, Arabic RTL.');
  } finally { await app.close(); await fs.rm(root, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
