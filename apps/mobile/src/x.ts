import { buildSizeEstimates } from '../../../packages/core/file-size.js';
import { parseMediaURL, isXVideoID } from '../../../packages/core/media-source.js';
import { xPostURL, xPostData, xVideoMetadata, xUnavailable } from '../../../packages/core/x-metadata.js';
import { bounded } from './requests.ts';
import type { Preview, PlaylistPreview, MediaMode, DownloadPlan } from './domain.ts';

type Request = (url: string, signal?: AbortSignal) => Promise<{ status: number; text(): Promise<string> }>;

/** Uses the existing cancellable native metadata transport; media stays in Android's service. */
export function createXService(request: Request) {
  async function post(postId: string, signal?: AbortSignal) {
    if (signal?.aborted) throw new Error('CANCELLED');
    const controller = new AbortController();
    let rejectAbort: (error: Error) => void;
    const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
    const abort = () => { controller.abort(); rejectAbort(new Error('CANCELLED')); };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    try {
      return await bounded(Promise.race([aborted, (async () => {
        const response = await request(xPostURL(postId), controller.signal);
        if (signal?.aborted) throw new Error('CANCELLED');
        if ([401, 403, 404].includes(response.status)) throw xUnavailable();
        if (response.status === 429) throw new Error('X is limiting requests. Please try again later.');
        if (response.status !== 200) throw new Error(`X download rejected (HTTP ${response.status}). Please try again later.`);
        const text = await response.text();
        if (text.length > 2 * 1024 * 1024) throw new Error('X returned too much post data. Please try another post.');
        let data;
        try { data = JSON.parse(text); } catch { throw xUnavailable(); }
        return xPostData(postId, data);
      })()]), 25000, () => controller.abort());
    } finally {
      signal?.removeEventListener('abort', abort);
    }
  }
  const choices = (infos: ReturnType<typeof xVideoMetadata>[]) => [...new Set(infos.flatMap(info => info.streaming_data.formats.map(format => format.quality_label)))].sort((a, b) => parseInt(b) - parseInt(a));
  return {
    async inspect(url: string, signal?: AbortSignal): Promise<Preview | PlaylistPreview> {
      const parsed = parseMediaURL(url);
      if (parsed.provider !== 'x' || !parsed.postId) throw new Error('Enter a valid YouTube or X post URL.');
      const data = await post(parsed.postId, signal);
      const infos = data.media.map((_, index) => xVideoMetadata(parsed.postId!, index + 1, data));
      const index = (parsed.selectedVideo || 1) - 1;
      const info = infos[index];
      if (!info) throw new Error('The selected video is not available in this X post.');
      if (infos.length === 1 || parsed.selectedVideo) return {
        kind: 'video', provider: 'x', id: `x-${parsed.postId}-${index + 1}`,
        title: info.basic_info.title, author: info.basic_info.author,
        thumbnail: info.basic_info.thumbnail[0]?.url, qualities: choices([info]), audioAvailable: true, sizeEstimates: buildSizeEstimates(info),
      };
      return {
        kind: 'playlist', provider: 'x', id: `x-${parsed.postId}-1`,
        title: `${info.basic_info.author} — X post ${parsed.postId}`, qualities: choices(infos),
        thumbnail: info.basic_info.thumbnail[0]?.url,
        items: infos.map((entry, i) => ({ id: `x-${parsed.postId}-${i + 1}`, index: i + 1, title: entry.basic_info.title, thumbnail: entry.basic_info.thumbnail[0]?.url, sizeEstimates: buildSizeEstimates(entry) })),
      };
    },
    async resolve(id: string, quality: string, mode: MediaMode, signal?: AbortSignal): Promise<DownloadPlan> {
      if (!isXVideoID(id)) throw new Error('Invalid X video.');
      const [, postId, index] = id.split('-');
      const info = xVideoMetadata(postId, Number(index), await post(postId, signal));
      const requested = parseInt(quality);
      const formats = info.streaming_data.formats.filter(format => mode === 'mp3' || quality === 'best' || parseInt(format.quality_label) <= requested)
        .sort((a, b) => mode === 'mp3' ? b.bitrate - a.bitrate : parseInt(b.quality_label) - parseInt(a.quality_label) || b.bitrate - a.bitrate);
      if (!formats.length) throw new Error('NO_FORMATS');
      return {
        videoId: id, title: info.basic_info.title.slice(0, 180), mode,
        requestedQuality: mode === 'mp3' ? 'MP3' : quality,
        candidates: formats.slice(0, 24).map(format => ({
          quality: mode === 'mp3' ? 'MP3' : format.quality_label,
          [mode === 'mp3' ? 'audio' : 'video']: { url: format.url, size: 0, itag: format.itag },
        })),
      };
    },
  };
}
