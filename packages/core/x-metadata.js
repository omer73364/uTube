import { safeMediaThumbnail } from './media-source.js';

/** @typedef {{itag: number, url: string, width: number, height: number, quality_label: string, mime_type: string, has_video: boolean, has_audio: boolean, bitrate: number, content_length?: number, estimated_content_length?: number}} XFormat */
/** @typedef {{data: {id_str: string, text?: string, user?: {name?: string, screen_name?: string}}, media: {media_url_https?: string, video_info: {duration_millis?: number, variants: {url?: string, content_type?: string, bitrate?: number}[]}}[]}} XPost */
/** @typedef {{provider: string, basic_info: {title: string, author: string, duration: number, thumbnail: {url?: string}[]}, streaming_data: {formats: XFormat[]}}} XMetadata */

export const xUnavailable = () => new Error('This X post is unavailable or requires sign-in. Only public video posts are supported.');

export function xPostURL(postId) {
  if (!/^[1-9]\d{14,19}$/.test(postId)) throw new Error('Invalid X video.');
  const url = new URL('https://cdn.syndication.twimg.com/tweet-result');
  url.searchParams.set('id', postId);
  url.searchParams.set('lang', 'en');
  // Token used by X's public embedded-post endpoint.
  url.searchParams.set('token', (Number(postId) / 1e15 * Math.PI).toString(36).replace(/(0+|\.)/g, ''));
  return url.href;
}

export function xMediaURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'video.twimg.com' && !url.username && !url.password && !url.port && url.pathname.endsWith('.mp4') ? url.href : null;
  } catch { return null; }
}

/** @returns {XPost} */
export function xPostData(postId, data) {
  if (!data?.id_str || data.id_str !== postId) throw xUnavailable();
  const media = (Array.isArray(data.mediaDetails) ? data.mediaDetails : []).filter(item => item?.type === 'video' && Array.isArray(item.video_info?.variants)).slice(0, 4);
  if (!media.length) throw new Error('This X post has no downloadable public video. Photos, live broadcasts, and external links are not supported.');
  return { data, media };
}

/** Node-free metadata shared by desktop, CLI, and React Native.
 * @param {string} postId
 * @param {number} index
 * @param {XPost} post
 * @returns {XMetadata}
 */
export function xVideoMetadata(postId, index, post) {
  const media = post.media[index - 1];
  if (!media) throw new Error('The selected video is not available in this X post.');
  const author = String(post.data.user?.name || post.data.user?.screen_name || 'X');
  const text = String(post.data.text || '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  const title = `${author} — ${text || `X post ${postId}`}`.slice(0, 200) + (post.media.length > 1 ? ` — ${index}` : '');
  const seen = new Set();
  const formats = media.video_info.variants.flatMap((variant) => {
    const url = xMediaURL(variant?.url);
    const dimensions = url?.match(/\/(\d{2,5})x(\d{2,5})\//);
    if (variant?.content_type !== 'video/mp4' || !url || !dimensions || seen.has(url)) return [];
    seen.add(url);
    // The shorter edge gives consistent resolution labels for portrait and landscape.
    const height = Math.min(Number(dimensions[1]), Number(dimensions[2]));
    if (height < 100 || height > 9999) return [];
    return [{ itag: seen.size, url, width: Number(dimensions[1]), height, quality_label: `${height}p`, mime_type: 'video/mp4', has_video: true, has_audio: true, bitrate: Number(variant.bitrate) || 0 }];
  }).sort((a, b) => b.bitrate - a.bitrate);
  if (!formats.length) throw new Error('This X video has no downloadable MP4 streams. Try another public video post.');
  return {
    provider: 'x',
    basic_info: { title, author, duration: Number(media.video_info.duration_millis || 0) / 1000, thumbnail: [{ url: safeMediaThumbnail(media.media_url_https) }] },
    streaming_data: { formats },
  };
}
