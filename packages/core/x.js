import { isXVideoID } from './media-source.js';
import { checkAbort } from './cancellation.js';
import { xPostURL, xPostData, xVideoMetadata, xUnavailable } from './x-metadata.js';

const httpError = (status) => {
  const error = new Error(status === 429 ? 'X is limiting requests. Please try again later.' : `X download rejected (HTTP ${status}). Please try again later.`);
  error.info = { response: { status } };
  return error;
};

/** Native public-post support: no account, cookies, or external downloader required. */
export function createXClient({ fetch: fetcher = globalThis.fetch } = {}) {
  async function getPost(postId, { signal } = {}) {
    checkAbort(signal);
    const response = await fetcher(xPostURL(postId), {
      signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(20000)]),
      redirect: 'error', headers: { 'User-Agent': 'Googlebot', Accept: 'application/json' },
    });
    if ([401, 403, 404].includes(response.status)) { await response.body?.cancel(); throw xUnavailable(); }
    if (!response.ok) { await response.body?.cancel(); throw httpError(response.status); }
    const reader = response.body?.getReader();
    if (!reader) throw xUnavailable();
    const parts = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2 * 1024 * 1024) throw new Error('X returned too much post data. Please try another post.');
        parts.push(Buffer.from(value));
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    let data;
    try { data = JSON.parse(Buffer.concat(parts).toString('utf8')); }
    catch { throw xUnavailable(); }
    return xPostData(postId, data);
  }

  function videoInfo(postId, index, post, { signal } = {}) {
    const metadata = xVideoMetadata(postId, index, post);
    const formats = metadata.streaming_data.formats;
    return {
      ...metadata,
      async download({ itag, range }) {
        checkAbort(signal);
        const format = formats.find(item => item.itag === itag);
        if (!format) throw new Error('The selected X video quality is unavailable.');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(new Error('X media connection timed out. Please retry.')), 20000);
        let response;
        try {
          response = await fetcher(format.url, {
            redirect: 'error', signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
            headers: range ? { Range: `bytes=${range.start}-${range.end}` } : {},
          });
        } finally { clearTimeout(timeout); }
        if (!response.ok) { await response.body?.cancel(); throw httpError(response.status); }
        if (range && response.status !== 206) { await response.body?.cancel(); throw new Error('X ignored the requested byte range. Please retry.'); }
        if (!response.body || !/^video\/mp4(?:;|$)/i.test(response.headers.get('content-type') || '')) {
          await response.body?.cancel(); throw new Error('X returned an invalid video stream. Please retry.');
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
      if (!isXVideoID(id)) throw new Error('Invalid X video.');
      const [, postId, index] = id.split('-');
      return videoInfo(postId, Number(index), await getPost(postId, options), options);
    },
  };
}
