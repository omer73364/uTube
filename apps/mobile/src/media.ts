import { parseMediaURL, isXVideoID, isInstagramVideoID } from '../../../packages/core/media-source.js';
import type { Preview, PlaylistPreview, DownloadPlan, MediaMode } from './domain.ts';

type Service = {
  inspect(url: string, signal?: AbortSignal): Promise<Preview | PlaylistPreview>;
  resolve(id: string, quality: string, mode: MediaMode, signal?: AbortSignal): Promise<DownloadPlan>;
};

/** Route before initializing a provider: other providers never need the YouTube player. */
export function createMediaService(youtube: Service, x: Service, instagram?: Service): Service {
  return {
    inspect(url, signal) {
      const provider = parseMediaURL(url).provider;
      if (provider === 'instagram') {
        if (!instagram) throw new Error('Instagram is unavailable.');
        return instagram.inspect(url, signal);
      }
      return (provider === 'x' ? x : youtube).inspect(url, signal);
    },
    resolve(id, quality, mode, signal) {
      if (isInstagramVideoID(id)) {
        if (!instagram) throw new Error('Instagram is unavailable.');
        return instagram.resolve(id, quality, mode, signal);
      }
      return (isXVideoID(id) ? x : youtube).resolve(id, quality, mode, signal);
    },
  };
}
