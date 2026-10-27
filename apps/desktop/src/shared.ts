import type { Language } from './locales';
export type Preview = {
  type: 'video' | 'playlist'; provider?: 'youtube' | 'x' | 'instagram'; id: string; title: string; author?: string;
  duration?: number; thumbnail?: string | null; qualities?: string[];
  items?: { id: string; title: string; thumbnail?: string }[];
};
export type Job = {
  id: string; videoId: string; thumbnail?: string; title: string; audio: boolean; quality?: string;
  status: 'queued' | 'running' | 'cancelling' | 'saved' | 'skipped' | 'failed' | 'cancelled';
  stage?: string; loaded: number; total?: number; speed?: number; eta?: number; note?: string; actualQuality?: string;
  path?: string; error?: string;
  playlistTitle?: string; createdAt?: number; completedAt?: number; interrupted?: boolean;
};
export type DownloadRequest = {
  items: { id: string; title: string; index?: number; thumbnail?: string }[];
  playlistTitle?: string; audio: boolean; quality?: string;
};
export type Preferences = { theme: 'light' | 'dark' | 'system'; language: Language };
export type Appearance = Preferences & { resolvedTheme: 'light' | 'dark' };
export type Settings = Appearance & { folder: string; version: string; ffmpeg: boolean; ffmpegSetupSupported?: boolean; ffmpegInstalling?: boolean; ffmpegProgress?: { loaded: number; total: number }; historyError?: string };
export type DesktopAPI = {
  installFFmpeg(): Promise<{ ffmpeg: boolean }>;
  cancelFFmpeg(): Promise<void>;
  openFFmpegSource(): Promise<void>;
  onFFmpegProgress(listener: (progress: { loaded: number; total: number; done?: boolean; ffmpeg?: boolean; failed?: boolean }) => void): () => void;
  settings(): Promise<Settings>;
  openRepository(): Promise<void>;
  preferences(patch: Partial<Preferences>): Promise<Appearance>;
  onTheme(listener: (dark: boolean) => void): () => void;
  onHistoryError(listener: (message: string) => void): () => void;
  chooseFolder(): Promise<string | null>;
  inspect(url: string): Promise<Preview>;
  enqueue(request: DownloadRequest): Promise<string[]>;
  jobs(): Promise<Job[]>;
  cancel(id: string): Promise<void>;
  retry(id: string): Promise<void>;
  openFolder(id?: string): Promise<void>;
  openFile(id: string): Promise<void>;
  onJobs(listener: (jobs: Job[]) => void): () => void;
};
declare global { interface Window { utube: DesktopAPI } }
