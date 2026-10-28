import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAPI, Job, UpdateState } from '../shared';
async function invoke(channel: string, ...args: unknown[]) {
  const response = await ipcRenderer.invoke(channel, ...args);
  if (!response.ok) throw new Error(response.error);
  return response.value;
}
const api: DesktopAPI = {
  updates: () => invoke('utube:updates'),
  checkUpdates: () => invoke('utube:check-updates'),
  downloadUpdate: () => invoke('utube:download-update'),
  cancelUpdate: () => invoke('utube:cancel-update'),
  installUpdate: (interrupt) => invoke('utube:install-update', interrupt),
  onUpdates: (listener) => {
    const handler = (_event: unknown, state: UpdateState) => listener(state);
    ipcRenderer.on('utube:updates-changed', handler);
    return () => ipcRenderer.removeListener('utube:updates-changed', handler);
  },
  openRepository: () => invoke('utube:open-repository'),
  installFFmpeg: () => invoke('utube:install-ffmpeg'),
  cancelFFmpeg: () => invoke('utube:cancel-ffmpeg'),
  openFFmpegSource: () => invoke('utube:ffmpeg-source'),
  onFFmpegProgress: (listener) => {
    const handler = (_event: unknown, progress: { loaded: number; total: number; done?: boolean; ffmpeg?: boolean; failed?: boolean }) => listener(progress);
    ipcRenderer.on('utube:ffmpeg-progress', handler);
    return () => ipcRenderer.removeListener('utube:ffmpeg-progress', handler);
  },
  settings: () => invoke('utube:settings'),
  preferences: (patch) => invoke('utube:preferences', patch),
  chooseFolder: () => invoke('utube:choose-folder'),
  inspect: (url) => invoke('utube:inspect', url),
  enqueue: (request) => invoke('utube:enqueue', request),
  jobs: () => invoke('utube:jobs'),
  cancel: (id) => invoke('utube:cancel', id),
  retry: (id) => invoke('utube:retry', id),
  openFolder: (id) => invoke('utube:open-folder', id),
  openFile: (id) => invoke('utube:open-file', id),
  onHistoryError: (listener) => {
    const handler = (_event: unknown, message: string) => listener(message);
    ipcRenderer.on('utube:history-error', handler);
    return () => ipcRenderer.removeListener('utube:history-error', handler);
  },
  onTheme: (listener) => {
    const handler = (_event: unknown, dark: boolean) => listener(dark);
    ipcRenderer.on('utube:theme-changed', handler);
    return () => ipcRenderer.removeListener('utube:theme-changed', handler);
  },
  onJobs: (listener) => {
    const handler = (_event: unknown, jobs: Job[]) => listener(jobs);
    ipcRenderer.on('utube:jobs-changed', handler);
    return () => ipcRenderer.removeListener('utube:jobs-changed', handler);
  },
};
contextBridge.exposeInMainWorld('utube', api);
