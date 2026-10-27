import { app, BrowserWindow, dialog, ipcMain, shell, nativeTheme } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { WorkerBridge } from './bridge';
import { DownloadQueue } from './queue.mjs';
import { DownloadHistory } from './history.mjs';
import { validateURL, validateRequest, validateJobID } from './validation.mjs';
import type { DownloadRequest, Job, Preferences } from '../shared';
import { translator, languages } from '../locales';
import { createFFmpegManager } from '../../../../packages/core/ffmpeg.js';
import squirrelStartup from 'electron-squirrel-startup';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
app.setName('uTube');
// Keep existing settings and download history when updating the app name.
const requestedProfile = app.commandLine.getSwitchValue('user-data-dir');
app.setPath('userData', requestedProfile ? path.resolve(requestedProfile) : path.join(app.getPath('appData'), 'uTube Desktop'));
if (!app.isPackaged && process.env.UTUBE_TEST_USER_DATA) app.setPath('userData', process.env.UTUBE_TEST_USER_DATA);
const mediaTools = createFFmpegManager({ directory: app.getPath('userData') });
let toolInstall: AbortController | undefined;
let toolProgress: { loaded: number; total: number } | undefined;
let window: BrowserWindow;
let folder: string;
let preferences: Preferences = { theme: 'system', language: 'en' };
let writes = Promise.resolve();
let closing = false;
let closeRequested = false;
let history: DownloadHistory;
let historyError: string | undefined;
function reportHistoryError(message: string) {
  historyError = message;
  if (window && !window.isDestroyed()) window.webContents.send('utube:history-error', message);
}
const bridge = new WorkerBridge();
const queue = new DownloadQueue(
  async (job: any, options: any) => { const { controller, ...request } = job; return bridge.call('download', { job: request, ffmpegPath: await mediaTools.resolve() || process.env.UTUBE_FFMPEG || 'ffmpeg' }, options); },
  (jobs: any[]) => {
    if (window && !window.isDestroyed()) window.webContents.send('utube:jobs-changed', jobs);
    if (history) void history.save(jobs).catch(() => reportHistoryError('Download history could not be saved. Check available disk space and permissions.'));
  },
);
const prefsFile = () => path.join(app.getPath('userData'), 'settings.json');
function saveSettings(patch: Partial<Preferences> & { folder?: string }) {
  const pending = writes.then(async () => {
    const next = { folder, ...preferences, ...patch };
    await fs.mkdir(app.getPath('userData'), { recursive: true });
    const temporary = `${prefsFile()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(next));
    await fs.rename(temporary, prefsFile());
    folder = next.folder;
    preferences = { theme: next.theme, language: next.language };
    nativeTheme.themeSource = preferences.theme;
  });
  writes = pending.catch(() => {});
  return pending;
}
async function hasFFmpeg() { return Boolean(await mediaTools.resolve()); }

function handle(name: string, fn: (...args: any[]) => any) {
  ipcMain.handle(name, async (event, ...args) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) return { ok: false, error: 'Untrusted window.' };
    try { return { ok: true, value: await fn(...args) }; }
    catch (error: any) { return { ok: false, error: error.message || 'Something went wrong. Please try again.' }; }
  });
}
async function createWindow() {
  history = new DownloadHistory(path.join(app.getPath('userData'), 'downloads.json'));
  const restored = await history.load();
  historyError = history.warning;
  queue.restore(restored);
  folder = app.getPath('downloads');
  try {
    const stored = JSON.parse(await fs.readFile(prefsFile(), 'utf8'));
    if (typeof stored.folder === 'string' && path.isAbsolute(stored.folder)) folder = stored.folder;
    if (['light', 'dark', 'system'].includes(stored.theme)) preferences.theme = stored.theme;
    if (languages.some((item) => item.code === stored.language)) preferences.language = stored.language;
  } catch { /* First launch uses defaults. */ }
  nativeTheme.themeSource = preferences.theme;
  window = new BrowserWindow({
    width: 1240, height: 860, minWidth: 850, minHeight: 640, backgroundColor: nativeTheme.shouldUseDarkColors ? '#17191d' : '#f7f8fa',
    title: 'uTube', autoHideMenuBar: true,
    icon: app.isPackaged ? path.join(process.resourcesPath, 'icon.png') : path.join(app.getAppPath(), 'assets/icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  nativeTheme.on('updated', () => {
    if (window.isDestroyed()) return;
    window.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#17191d' : '#f7f8fa');
    window.webContents.send('utube:theme-changed', nativeTheme.shouldUseDarkColors);
  });
  const appearance = () => ({ ...preferences, resolvedTheme: nativeTheme.shouldUseDarkColors ? 'dark' as const : 'light' as const });
  handle('utube:open-repository', () => shell.openExternal('https://github.com/omer73364/uTube'));
  handle('utube:settings', async () => {
    const ffmpeg = await hasFFmpeg();
    return { folder, ...appearance(), version: app.getVersion(), ffmpeg, historyError, ffmpegSetupSupported: mediaTools.supported, ffmpegInstalling: Boolean(toolInstall), ffmpegProgress: toolProgress };
  });
  handle('utube:install-ffmpeg', async () => {
    if (toolInstall) throw new Error('FFmpeg setup is already running.');
    toolInstall = new AbortController();
    toolProgress = { loaded: 0, total: 0 };
    let lastProgress = 0;
    let succeeded = false;
    try {
      await mediaTools.install({ signal: toolInstall.signal, onProgress: (progress: { loaded: number; total: number }) => {
        toolProgress = progress;
        if (!window.isDestroyed() && Date.now() - lastProgress > 150) {
          lastProgress = Date.now();
          window.webContents.send('utube:ffmpeg-progress', progress);
        }
      } });
      succeeded = true;
      return { ffmpeg: await hasFFmpeg() };
    } finally {
      const cancelled = toolInstall?.signal.aborted;
      toolInstall = undefined; toolProgress = undefined;
      if (!window.isDestroyed()) window.webContents.send('utube:ffmpeg-progress', { loaded: 0, total: 0, done: true, ffmpeg: succeeded, failed: !succeeded && !cancelled });
    }
  });
  handle('utube:cancel-ffmpeg', () => toolInstall?.abort());
  handle('utube:ffmpeg-source', () => shell.openExternal('https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1'));
  handle('utube:preferences', async (patch: Partial<Preferences>) => {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some((key) => !['theme', 'language'].includes(key)) ||
      ('theme' in patch && !['light', 'dark', 'system'].includes(patch.theme!)) ||
      ('language' in patch && !languages.some((item) => item.code === patch.language))) throw new Error('Invalid preferences.');
    await saveSettings(patch);
    window.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#17191d' : '#f7f8fa');
    return appearance();
  });
  handle('utube:choose-folder', async () => {
    const result = await dialog.showOpenDialog(window, { title: translator(preferences.language)('saveTo'), defaultPath: folder, properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;
    await saveSettings({ folder: result.filePaths[0] }); return folder;
  });
  handle('utube:inspect', (url: string) => bridge.call('inspect', { url: validateURL(url) }, { signal: AbortSignal.timeout(30000) }));
  handle('utube:enqueue', (request: DownloadRequest) => {
    const valid = validateRequest(request);
    return queue.add(valid.items.map((item: any) => ({
      videoId: item.id, thumbnail: item.thumbnail, title: valid.playlistTitle ? `#${item.index + 1}_${item.title}` : item.title,
      playlistTitle: valid.playlistTitle, audio: valid.audio, quality: valid.quality, folder,
    })));
  });
  handle('utube:jobs', () => queue.snapshot());
  handle('utube:cancel', (id: string) => queue.cancel(validateJobID(id)));
  handle('utube:retry', (id: string) => queue.retry(validateJobID(id)));
  handle('utube:open-file', async (id: string) => {
    const job = queue.snapshot().find((entry: any) => entry.id === validateJobID(id)) as unknown as Job | undefined;
    if (!job?.path || !['saved', 'skipped'].includes(job.status)) throw new Error('This download is not ready to open.');
    try { await fs.access(job.path); } catch { throw new Error('This file was moved or deleted. Download it again.'); }
    const error = await shell.openPath(job.path);
    if (error) throw new Error(error);
  });
  handle('utube:open-folder', async (id?: string) => {
    const job = id ? queue.snapshot().find((entry: any) => entry.id === validateJobID(id)) as unknown as Job : undefined;
    if (id && !job) throw new Error('Download not found.');
    if (job?.path) { shell.showItemInFolder(job.path); return; }
    const error = await shell.openPath(folder);
    if (error) throw new Error(error);
  });
  window.on('close', (event) => {
    if (closing) return;
    event.preventDefault();
    if (closeRequested) return;
    closeRequested = true;
    void (async () => {
      const t = translator(preferences.language);
      if (queue.hasPending()) {
      const { response } = await dialog.showMessageBox(window, {
        type: 'question', title: t('quitTitle'),
        message: t('quitQuestion'), detail: t('quitDetail'),
        buttons: [t('keepDownloading'), t('cancelQuit')], defaultId: 0, cancelId: 0,
      });
      if (response !== 1) { closeRequested = false; return; }
      }
      toolInstall?.abort();
      const deadline = setTimeout(() => bridge.dispose(), 5000);
      try {
        await queue.shutdown();
        await history.flush();
        await writes;
      } catch {
        await dialog.showMessageBox(window, { type: 'error', title: t('historyTitle'), message: t('historySaveError'), buttons: [t('close')] });
      } finally { clearTimeout(deadline); bridge.dispose(); closing = true; window.close(); }
    })();
  });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) await window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  else await window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
}
if (squirrelStartup) {
  app.quit();
} else if (app.requestSingleInstanceLock()) {
  app.on('second-instance', () => {
    if (window && !window.isDestroyed()) { if (window.isMinimized()) window.restore(); window.focus(); }
  });
  app.whenReady().then(createWindow);
} else app.quit();
app.on('window-all-closed', () => app.quit());
