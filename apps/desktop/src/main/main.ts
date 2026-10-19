import { app, BrowserWindow } from 'electron';
import path from 'node:path';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

function createWindow() {
  const window = new BrowserWindow({
    width: 1200, height: 820, minWidth: 850, minHeight: 640, backgroundColor: '#f5f7fb',
    title: 'uTube Desktop', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  else window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
