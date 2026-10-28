// UI-only integration test. No media requests or downloads are made.
const { _electron: electron } = require('playwright');
const { expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-size-ui-'));
  const url = process.env.UTUBE_RENDERER_URL || 'http://127.0.0.1:4185/';
  await fs.writeFile(path.join(root, 'preload.cjs'), `
    const { contextBridge } = require('electron');
    let prefs = { language: 'en', theme: 'light', resolvedTheme: 'light', folder: '/Downloads/uTube', version: '2.5.0', ffmpeg: true };
    let kind = 'video';
    const sizes = { video: { '360p': 1000000, '1080p': 6000000, best: 6000000 }, mp3: 2880000 };
    contextBridge.exposeInMainWorld('__sizeTest', { kind: value => { kind = value; } });
    contextBridge.exposeInMainWorld('utube', {
      settings: async () => prefs, jobs: async () => [],
      preferences: async patch => { prefs = { ...prefs, ...patch, resolvedTheme: patch.theme === 'dark' ? 'dark' : prefs.resolvedTheme }; return prefs; },
      onJobs: () => () => {}, onTheme: () => () => {}, onHistoryError: () => () => {},
      inspect: async () => kind === 'playlist'
        ? { type: 'playlist', id: 'PLtest', title: 'Selected videos', qualities: ['360p', '1080p'], items: [
            { id: 'jNQXAC9IVRw', title: 'Known video', sizeEstimates: sizes },
            { id: 'BaW_jenozKc', title: 'Unknown video' } ] }
        : { type: 'video', id: 'jNQXAC9IVRw', title: 'A video', qualities: ['360p', '1080p'], ...(kind === 'video' ? { sizeEstimates: sizes } : {}) },
      openFolder: async () => {},
      enqueue: async () => { throw Error('test must not download'); },
    });
  `);
  await fs.writeFile(path.join(root, 'main.cjs'), `
    const { app, BrowserWindow } = require('electron');
    app.whenReady().then(() => new BrowserWindow({ width: 1180, height: 950, webPreferences: { preload: ${JSON.stringify(path.join(root, 'preload.cjs'))}, contextIsolation: true, sandbox: false } }).loadURL(${JSON.stringify(url)}));
  `);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', path.join(root, 'main.cjs')], env });
  try {
    const page = await app.firstWindow();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const submit = async () => {
      await page.getByRole('textbox', { name: 'YouTube, X, Instagram, or Facebook URL' }).fill('https://youtu.be/jNQXAC9IVRw');
      await page.getByRole('button', { name: 'Preview link', exact: true }).click();
    };
    await submit();
    const size = page.locator('.file-size-estimate');
    // Inspect every option before changing the initial selection.
    await expect(page.locator('#quality')).toHaveValue('360p');
    await expect(page.locator('#quality option[value="360p"]')).toContainText('≈ 1 MB');
    await expect(page.locator('#quality option[value="1080p"]')).toContainText('≈ 6 MB');
    await expect(size).toHaveCount(0);
    await page.getByLabel('Video quality', { exact: true }).selectOption('1080p');
    await expect(page.locator('#quality option:checked')).toContainText('≈ 6 MB');
    // The size is visible above the download button, without pressing it.
    const sizeBounds = await page.locator('.quality-row').boundingBox();
    const buttonBounds = await page.locator('.download-button').boundingBox();
    expect(sizeBounds.y + sizeBounds.height).toBeLessThanOrEqual(buttonBounds.y + 1);
    await page.locator('.download-button').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/utube-file-size-hd.png', fullPage: true });
    await page.getByRole('button', { name: /Audio only/ }).click();
    await expect(size).toContainText('≈ 2.9 MB');
    await page.getByRole('button', { name: 'Close preview', exact: true }).click();
    await page.evaluate(() => window.__sizeTest.kind('playlist'));
    await submit();
    await expect(size).toContainText('+ ?');
    await expect(size).toContainText('1 of 2');
    await page.getByRole('checkbox').nth(1).uncheck();
    await expect(size).not.toContainText('+ ?');
    await page.getByRole('checkbox').first().uncheck();
    await expect(size).toContainText('Select videos');
    await page.getByRole('button', { name: 'Close preview', exact: true }).click();
    await page.evaluate(() => window.__sizeTest.kind('unknown'));
    await submit();
    await page.getByRole('button', { name: 'Video MP4 with audio', exact: true }).click();
    await expect(page.locator('#quality option[value="360p"]')).toContainText('Size unavailable');
    await expect(page.locator('#quality option[value="1080p"]')).toContainText('Size unavailable');
    await expect(page.locator('.download-button')).toBeEnabled();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('radio', { name: 'العربية', exact: true }).click();
    await page.getByRole('radio', { name: 'داكن', exact: true }).click();
    await page.getByRole('button', { name: 'الرئيسية', exact: true }).click();
    await expect(page.locator('#quality option[value="360p"]')).toContainText('الحجم غير متاح');
    await expect(page.locator('#quality option[value="1080p"]')).toContainText('الحجم غير متاح');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.locator('.quality-row').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/utube-file-size-ar.png', fullPage: true });
    expect(errors).toEqual([]);
    console.log('PASS: sizes on EVERY quality option BEFORE selection, MP3 output, selection totals, partial/unknown states, pre-download placement, Arabic/dark mode.');
  } finally { await app.close(); await fs.rm(root, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
