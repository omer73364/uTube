import { instagramMediaURL } from './instagram-metadata.js';
import { facebookMediaURL } from './facebook-metadata.js';

// Only probe provider-validated CDN URLs. HEAD never consumes a media body.
// A failed size lookup must not prevent previewing or downloading the video.
export async function populateMediaSizes(post, metadata, request, { signal } = {}) {
  const formats = post.media.flatMap((_, index) => metadata(index + 1).streaming_data.formats);
  const urls = [...new Set(formats.map(format => format.url))];
  post.mediaSizes = {};
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, urls.length) }, async () => {
    while (next < urls.length) {
      if (signal?.aborted) throw new Error('CANCELLED');
      const url = urls[next++];
      if (!instagramMediaURL(url) && !facebookMediaURL(url)) continue;
      const controller = new AbortController();
      let rejectAbort;
      const aborted = new Promise((_, reject) => { rejectAbort = reject; });
      const abort = () => { controller.abort(); rejectAbort(new Error('CANCELLED')); };
      signal?.addEventListener('abort', abort, { once: true });
      let timer;
      try {
        const response = await Promise.race([
          aborted,
          request(url, { method: 'HEAD', redirect: 'error', credentials: 'omit', signal: controller.signal }),
          new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Size lookup timed out')); }, 5000); }),
        ]);
        const length = Number(response.headers?.get('content-length'));
        if (response.status === 200 && /^video\/mp4(?:;|$)/i.test(response.headers?.get('content-type') || '') && Number.isSafeInteger(length) && length > 0 && !response.headers?.get('content-encoding')) post.mediaSizes[url] = length;
      } catch {
        if (signal?.aborted) throw new Error('CANCELLED');
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
    }
  }));
  return post;
}
