import { parseMediaURL, isXVideoID, isInstagramVideoID, isFacebookVideoID } from '../../../packages/core/media-source.js';
import type { Preview, PlaylistPreview, DownloadPlan, MediaMode } from './domain.ts';

type Service = {
  inspect(url: string, signal?: AbortSignal): Promise<Preview | PlaylistPreview>;
  resolve(id: string, quality: string, mode: MediaMode, signal?: AbortSignal): Promise<DownloadPlan>;
};

/** Route before initializing a provider: other providers never need the YouTube player. */
export function createMediaService(youtube: Service, x: Service, instagram?: Service, facebook?: Service): Service {
  return {
    inspect(url, signal) {
      const provider = parseMediaURL(url).provider;
      if (provider === 'facebook') {
        if (!facebook) throw new Error('Facebook is unavailable.');
        return facebook.inspect(url, signal);
      }
      if (provider === 'instagram') {
        if (!instagram) throw new Error('Instagram is unavailable.');
        return instagram.inspect(url, signal);
      }
      return (provider === 'x' ? x : youtube).inspect(url, signal);
    },
    resolve(id, quality, mode, signal) {
      if (isFacebookVideoID(id)) {
        if (!facebook) throw new Error('Facebook is unavailable.');
        return facebook.resolve(id, quality, mode, signal);
      }
      if (isInstagramVideoID(id)) {
        if (!instagram) throw new Error('Instagram is unavailable.');
        return instagram.resolve(id, quality, mode, signal);
      }
      return (isXVideoID(id) ? x : youtube).resolve(id, quality, mode, signal);
    },
  };
}
