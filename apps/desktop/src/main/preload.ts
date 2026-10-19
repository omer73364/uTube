import { contextBridge } from 'electron';
contextBridge.exposeInMainWorld('utube', { version: '0.1.0' });
