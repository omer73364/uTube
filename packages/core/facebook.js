import { fetchFacebookPost, facebookVideoMetadata } from './facebook-metadata.js';
import { isFacebookVideoID } from './media-source.js';
import { checkAbort } from './cancellation.js';

const httpError = (status) => {
  const error = new Error(status === 429 ? 'Facebook is limiting requests. Please try again later.' : `Facebook download rejected (HTTP ${status}). Please try again later.`);
  error.info = { response: { status } };
  return error;
};

/** Native public-post support: no account, cookies, or external downloader required. */
export function createFacebookClient({ fetch: fetcher = globalThis.fetch } = {}) {
  async function getPost(postId, { signal } = {}) {
    return fetchFacebookPost(postId, async (url, options) => {
      checkAbort(signal);
      const response = await fetcher(url, { ...options, redirect: 'manual', credentials: 'omit',
        signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(25000)]) });
      const reader = response.body?.getReader();
      let text = '';
      if (reader) {
        let size = 0;
        const parts = [];
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > 8 * 1024 * 1024) throw new Error('Facebook returned too much post data.');
            parts.push(Buffer.from(value));
          }
          text = Buffer.concat(parts).toString('utf8');
        } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      }
      return { status: response.status, headers: response.headers, text: async () => text };
    }, { signal });
  }

  function videoInfo(postId, index, post, { signal } = {}) {
    const metadata = facebookVideoMetadata(postId, index, post);
    const formats = metadata.streaming_data.formats;
    return {
      ...metadata,
      async download({ itag, range }) {
        checkAbort(signal);
        const format = formats.find(item => item.itag === itag);
        if (!format) throw new Error('The selected Facebook video quality is unavailable.');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(new Error('Facebook media connection timed out. Please retry.')), 20000);
        let response;
        try {
          response = await fetcher(format.url, {
            redirect: 'error', signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
            headers: range ? { Range: `bytes=${range.start}-${range.end}` } : {},
          });
        } finally { clearTimeout(timeout); }
        if (!response.ok) { await response.body?.cancel(); throw httpError(response.status); }
        if (range && response.status !== 206) { await response.body?.cancel(); throw new Error('Facebook ignored the requested byte range. Please retry.'); }
        if (!response.body || !/^video\/mp4(?:;|$)/i.test(response.headers.get('content-type') || '')) {
          await response.body?.cancel(); throw new Error('Facebook returned an invalid video stream. Please retry.');
        }
        const total = Number(response.headers.get('content-length'));
        if (!range && Number.isSafeInteger(total) && total > 0) format.content_length = total;
        return response.body;
      },
    };
  }

  return {
    getPost,
    videoInfo,
    async getInfo(id, options = {}) {
      if (!isFacebookVideoID(id)) throw new Error('Invalid Facebook video.');
      const [, postId, index] = id.match(/^fb-([1-9]\d{4,24})-(1)$/);
      return videoInfo(postId, Number(index), await getPost(postId, options), options);
    },
  };
}
