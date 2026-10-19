import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { WorkerBridge } from './bridge';
import { DownloadQueue } from './queue.mjs';
import { validateURL, validateRequest, validateJobID } from './validation.mjs';
import type { DownloadRequest, Job } from '../shared';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
app.setName('uTube Desktop');
if (!app.isPackaged && process.env.UTUBE_TEST_USER_DATA) app.setPath('userData', process.env.UTUBE_TEST_USER_DATA);
let window: BrowserWindow;
let folder: string;
let closing = false;
const bridge = new WorkerBridge();
const queue = new DownloadQueue(
  (job: any, options: any) => { const { controller, ...request } = job; return bridge.call('download', { job: request }, options); },
  (jobs: unknown) => { if (window && !window.isDestroyed()) window.webContents.send('utube:jobs-changed', jobs); },
);
const prefsFile = () => path.join(app.getPath('userData'), 'settings.json');
async function saveFolder(value: string) {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  const temporary = `${prefsFile()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify({ folder: value }));
  await fs.rename(temporary, prefsFile());
  folder = value;
}
async function hasFFmpeg() {
  try { await promisify(execFile)(process.env.UTUBE_FFMPEG || 'ffmpeg', ['-version'], { timeout: 5000 }); return true; }
  catch { return false; }
}
function handle(name: string, fn: (...args: any[]) => any) {
  ipcMain.handle(name, async (event, ...args) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) return { ok: false, error: 'Untrusted window.' };
    try { return { ok: true, value: await fn(...args) }; }
    catch (error: any) { return { ok: false, error: error.message || 'Something went wrong. Please try again.' }; }
  });
}
async function createWindow() {
  folder = app.getPath('downloads');
  try { const stored = JSON.parse(await fs.readFile(prefsFile(), 'utf8')); if (typeof stored.folder === 'string' && path.isAbsolute(stored.folder)) folder = stored.folder; } catch { /* First launch uses Downloads. */ }
  window = new BrowserWindow({
    width: 1240, height: 860, minWidth: 850, minHeight: 640, backgroundColor: '#f6f7fb',
    title: 'uTube Desktop', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  handle('utube:settings', async () => ({ folder, version: app.getVersion(), ffmpeg: await hasFFmpeg() }));
  handle('utube:choose-folder', async () => {
    const result = await dialog.showOpenDialog(window, { title: 'Save downloads to', defaultPath: folder, properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;
    await saveFolder(result.filePaths[0]); return folder;
  });
  handle('utube:inspect', (url: string) => bridge.call('inspect', { url: validateURL(url) }, { signal: AbortSignal.timeout(30000) }));
  handle('utube:enqueue', (request: DownloadRequest) => {
    const valid = validateRequest(request);
    return queue.add(valid.items.map((item: any) => ({
      videoId: item.id, title: valid.playlistTitle ? `#${item.index + 1}_${item.title}` : item.title,
      playlistTitle: valid.playlistTitle, audio: valid.audio, quality: valid.quality, folder,
    })));
  });
  handle('utube:jobs', () => queue.snapshot());
  handle('utube:cancel', (id: string) => queue.cancel(validateJobID(id)));
  handle('utube:retry', (id: string) => queue.retry(validateJobID(id)));
  handle('utube:open-folder', async (id?: string) => {
    const job = id ? queue.snapshot().find((entry: any) => entry.id === validateJobID(id)) as unknown as Job : undefined;
    if (id && !job) throw new Error('Download not found.');
    if (job?.path) { shell.showItemInFolder(job.path); return; }
    const error = await shell.openPath(folder);
    if (error) throw new Error(error);
  });
  window.on('close', (event) => {
    if (closing) return;
    if (!queue.hasPending()) { bridge.dispose(); return; }
    event.preventDefault();
    void (async () => {
      const { response } = await dialog.showMessageBox(window, {
        type: 'question', title: 'Downloads are still in progress',
        message: 'Cancel downloads and quit?', detail: 'Queued items will be cancelled and temporary files will be cleaned up.',
        buttons: ['Keep downloading', 'Cancel and quit'], defaultId: 0, cancelId: 0,
      });
      if (response !== 1) return;
      closing = true;
      const deadline = setTimeout(() => bridge.dispose(), 5000);
      try { await queue.shutdown(); } finally { clearTimeout(deadline); bridge.dispose(); window.close(); }
    })();
  });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) await window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  else await window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
