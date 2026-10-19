import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAPI, Job } from '../shared';
async function invoke(channel: string, ...args: unknown[]) {
  const response = await ipcRenderer.invoke(channel, ...args);
  if (!response.ok) throw new Error(response.error);
  return response.value;
}
const api: DesktopAPI = {
  settings: () => invoke('utube:settings'),
  chooseFolder: () => invoke('utube:choose-folder'),
  inspect: (url) => invoke('utube:inspect', url),
  enqueue: (request) => invoke('utube:enqueue', request),
  jobs: () => invoke('utube:jobs'),
  cancel: (id) => invoke('utube:cancel', id),
  retry: (id) => invoke('utube:retry', id),
  openFolder: (id) => invoke('utube:open-folder', id),
  onJobs: (listener) => {
    const handler = (_event: unknown, jobs: Job[]) => listener(jobs);
    ipcRenderer.on('utube:jobs-changed', handler);
    return () => ipcRenderer.removeListener('utube:jobs-changed', handler);
  },
};
contextBridge.exposeInMainWorld('utube', api);
