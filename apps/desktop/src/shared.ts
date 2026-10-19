export type Preview = {
  type: 'video' | 'playlist'; id: string; title: string; author?: string;
  duration?: number; thumbnail?: string | null; qualities?: string[];
  items?: { id: string; title: string }[];
};
export type Job = {
  id: string; videoId: string; title: string; audio: boolean; quality?: string;
  status: 'queued' | 'running' | 'cancelling' | 'saved' | 'skipped' | 'failed' | 'cancelled';
  stage?: string; loaded: number; total?: number; speed?: number; eta?: number; note?: string; actualQuality?: string;
  path?: string; error?: string;
};
export type DownloadRequest = {
  items: { id: string; title: string; index?: number }[];
  playlistTitle?: string; audio: boolean; quality?: string;
};
export type Settings = { folder: string; version: string; ffmpeg: boolean };
export type DesktopAPI = {
  settings(): Promise<Settings>;
  chooseFolder(): Promise<string | null>;
  inspect(url: string): Promise<Preview>;
  enqueue(request: DownloadRequest): Promise<string[]>;
  jobs(): Promise<Job[]>;
  cancel(id: string): Promise<void>;
  retry(id: string): Promise<void>;
  openFolder(id?: string): Promise<void>;
  onJobs(listener: (jobs: Job[]) => void): () => void;
};
declare global { interface Window { utube: DesktopAPI } }
