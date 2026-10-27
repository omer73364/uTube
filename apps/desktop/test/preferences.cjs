const jobAction = require('./job-action.cjs');
const { _electron: electron } = require('playwright');
const { expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'utube-preferences-'));
  const media = path.join(root, 'fixture.mp4');
  const prefs = path.join(root, 'prefs');
  const folder = path.join(root, 'Downloads');
  const changedFolder = path.join(root, 'Other downloads');
  await fs.mkdir(prefs); await fs.mkdir(folder); await fs.mkdir(changedFolder);
  await fs.writeFile(path.join(prefs, 'settings.json'), JSON.stringify({ folder }));
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=640x360:r=10', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.3', '-t', '0.3', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', media]);
  const env = { ...process.env, UTUBE_TEST_USER_DATA: prefs, UTUBE_TEST_MEDIA: media };
  delete env.ELECTRON_RUN_AS_NODE;
  const args = [path.resolve(__dirname, '..')];
  if (process.env.UTUBE_TEST_NO_SANDBOX === '1') args.unshift('--no-sandbox');
  let app;
  const launch = () => electron.launch({ executablePath: require('electron'), args, env });
  try {
    app = await launch();
    let page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: 'Download a video' })).toBeVisible();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('radio', { name: 'Light', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('radio', { name: 'Dark', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('dark');
    await page.getByRole('radio', { name: 'System', exact: true }).click();
    await expect.poll(() => app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('system');
    await expect(page.locator('html')).toHaveAttribute('data-theme', await app.evaluate(({ nativeTheme }) => nativeTheme.shouldUseDarkColors ? 'dark' : 'light'));
    await app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'dark'; });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('radio', { name: 'System', exact: true })).toHaveAttribute('aria-checked', 'true');
    await app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'light'; });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('radio', { name: 'Light', exact: true }).click();
    await page.getByRole('radio', { name: 'العربية', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'الإعدادات', exact: true })).toBeVisible();
    await app.evaluate(({ dialog }, value) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [value] }); }, changedFolder);
    await page.getByRole('button', { name: 'اختيار مجلد', exact: true }).click();
    await expect.poll(() => page.evaluate(async () => (await window.utube.settings()).folder)).toBe(changedFolder);
    await page.screenshot({ path: '/tmp/utube-simple-ar-settings.png', fullPage: true });
    await page.getByRole('button', { name: 'الرئيسية', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'تنزيل فيديو' })).toBeVisible();
    await page.getByRole('textbox', { name: 'رابط يوتيوب' }).fill('https://youtu.be/jNQXAC9IVRw');
    await page.getByRole('button', { name: 'عرض الرابط', exact: true }).click();
    await expect(page.getByTestId('source-preview')).toBeVisible();
    await page.getByRole('button', { name: 'تنزيل الفيديو', exact: true }).click();
    await expect.poll(() => page.evaluate(async () => (await window.utube.jobs())[0]?.status), { timeout: 20000 }).toBe('saved');
    await app.evaluate(({ shell }) => {
      globalThis.openedFiles = []; globalThis.revealedFiles = [];
      shell.openPath = async (value) => { globalThis.openedFiles.push(value); return ''; };
      shell.showItemInFolder = (value) => globalThis.revealedFiles.push(value);
    });
    const [job] = await page.evaluate(() => window.utube.jobs());
    await jobAction(page, `فتح ${job.title}`);
    expect(await app.evaluate(() => globalThis.openedFiles)).toEqual([job.path]);
    await jobAction(page, `إظهار ${job.title} في المجلد`);
    expect(await app.evaluate(() => globalThis.revealedFiles)).toEqual([job.path]);
    await page.getByRole('button', { name: 'التنزيلات', exact: true }).click();
    await expect(page.getByRole('group', { name: 'تصفية التنزيلات' })).toBeVisible();
    await page.getByRole('textbox', { name: 'البحث في التنزيلات' }).fill('missing');
    await expect(page.getByText('لا توجد تنزيلات مطابقة')).toBeVisible();
    await page.getByRole('button', { name: 'مسح التصفية' }).click();
    await page.setViewportSize({ width: 850, height: 640 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '/tmp/utube-simple-ar-queue.png', fullPage: true });
    const invalid = await page.evaluate(async () => {
      const errors = [];
      for (const patch of [{ language: 'invalid' }, { theme: 'invalid' }, { folder: '/tmp/untrusted' }]) {
        try { await window.utube.preferences(patch); } catch (error) { errors.push(error.message); }
      }
      try { await window.utube.openFile('../../arbitrary'); } catch (error) { errors.push(error.message); }
      return errors;
    });
    expect(invalid).toHaveLength(4);
    await fs.rm(job.path);
    await jobAction(page, `فتح ${job.title}`);
    await expect(page.getByRole('alert')).toContainText('نُقل الملف أو حُذف');
    expect(await app.evaluate(() => globalThis.openedFiles)).toEqual([job.path]);
    const stored = JSON.parse(await fs.readFile(path.join(prefs, 'settings.json')));
    expect(stored).toMatchObject({ theme: 'light', language: 'ar', folder: changedFolder });
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'م', code: 'KeyL', ctrlKey: true, bubbles: true })));
    await expect(page.getByRole('textbox', { name: 'رابط يوتيوب' })).toBeFocused();
    await app.close(); app = await launch(); page = await app.firstWindow();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('heading', { name: 'تنزيل فيديو' })).toBeVisible();
    await page.getByRole('button', { name: 'داكن', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.screenshot({ path: '/tmp/utube-simple-ar-dark.png', fullPage: true });
    await page.getByRole('button', { name: 'الإعدادات', exact: true }).click();
    await page.getByRole('radio', { name: 'English', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.getByRole('radio', { name: 'Light', exact: true }).click();
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.screenshot({ path: '/tmp/utube-simple-en-light.png', fullPage: true });
    console.log('PASS: light/dark/system themes, Arabic RTL, language switching, persistence, folder preservation, open/reveal file, missing file, request validation.');
  } finally {
    if (app) { await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1 }); }).catch(() => {}); await app.close().catch(() => {}); }
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
