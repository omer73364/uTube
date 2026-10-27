import { parseMediaURL, isXVideoID } from '../../../packages/core/media-source.js';
import type { Preview, PlaylistPreview, DownloadPlan, MediaMode } from './domain.ts';

type Service = {
  inspect(url: string, signal?: AbortSignal): Promise<Preview | PlaylistPreview>;
  resolve(id: string, quality: string, mode: MediaMode, signal?: AbortSignal): Promise<DownloadPlan>;
};

/** Route before initializing a provider: an X download never needs the YouTube player. */
export function createMediaService(youtube: Service, x: Service): Service {
  return {
    inspect(url, signal) {
      return (parseMediaURL(url).provider === 'x' ? x : youtube).inspect(url, signal);
    },
    resolve(id, quality, mode, signal) {
      return (isXVideoID(id) ? x : youtube).resolve(id, quality, mode, signal);
    },
  };
}
