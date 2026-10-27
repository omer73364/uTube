import { safeMediaThumbnail } from './media-source.js';

export const instagramUnavailable = () => new Error('This Instagram post is unavailable or requires sign-in. Try a public Reel or video post.');
export const instagramMediaURL = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname.endsWith('.cdninstagram.com') || url.hostname.endsWith('.fbcdn.net')) && url.pathname.endsWith('.mp4') ? url.href : null;
  } catch { return null; }
};
export function instagramMediaID(code) {
  if (!/^[A-Za-z0-9_-]{5,32}$/.test(code)) throw new Error('Invalid Instagram link.');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let number = 0n;
  for (const character of code) number = number * 64n + BigInt(alphabet.indexOf(character));
  return String(number);
}

// Inspect JSON data only; never evaluate scripts supplied by a remote page.
function findProduct(root, code) {
  const pending = [root];
  const mediaID = instagramMediaID(code);
  let count = 0;
  while (pending.length && count++ < 100000) {
    const value = pending.pop();
    if (!value || typeof value !== 'object') continue;
    const matches = value.code === code || value.shortcode === code || String(value.pk || value.id || '').split('_')[0] === mediaID;
    if (matches && (Array.isArray(value.video_versions) || value.video_url || value.carousel_media || value.edge_sidecar_to_children)) return value;
    pending.push(...Object.values(value).filter(entry => entry && typeof entry === 'object'));
  }
}
export function instagramPostData(code, data) {
  const product = findProduct(data, code);
  if (!product) throw instagramUnavailable();
  const edges = product.edge_sidecar_to_children?.edges;
  const children = Array.isArray(product.carousel_media) ? product.carousel_media : Array.isArray(edges) ? edges.map(edge => edge?.node) : [product];
  const media = children.filter(item => item && (Array.isArray(item.video_versions) && item.video_versions.length || item.video_url)).slice(0, 20);
  if (!media.length) throw new Error('This Instagram post has no downloadable video. Photos and Stories are not supported.');
  return { product, media };
}

export async function fetchInstagramPost(code, request, { signal } = {}) {
  const pageURL = `https://www.instagram.com/p/${code}/`;
  const headers = { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' };
  const page = await request(pageURL, { signal, headers });
  if (page.status === 429) throw new Error('Instagram is limiting requests. Please try again later.');
  if (page.status !== 200) throw instagramUnavailable();
  const html = await page.text();
  if (html.length > 8 * 1024 * 1024) throw new Error('Instagram returned too much post data.');
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try { data = JSON.parse(match[1]); } catch { continue; }
    const product = findProduct(data, code);
    if (product) return instagramPostData(code, product);
  }
  const token = html.match(/"LSD",\[\],\{"token":"([^"\\]+)"/)?.[1];
  if (!token) throw instagramUnavailable();
  const body = new URLSearchParams({ lsd: token, doc_id: '27130156389949648',
    fb_api_caller_class: 'RelayModern', fb_api_req_friendly_name: 'PolarisLoggedOutDesktopWWWPostRootContentQuery',
    server_timestamps: 'true', variables: JSON.stringify({ media_id: instagramMediaID(code) }) }).toString();
  const response = await request('https://www.instagram.com/api/graphql', { signal, method: 'POST', body,
    headers: { ...headers, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded',
      'X-FB-LSD': token, 'X-FB-Friendly-Name': 'PolarisLoggedOutDesktopWWWPostRootContentQuery', Referer: pageURL } });
  if (response.status === 429) throw new Error('Instagram is limiting requests. Please try again later.');
  if (response.status !== 200) throw instagramUnavailable();
  const text = await response.text();
  if (text.length > 8 * 1024 * 1024) throw new Error('Instagram returned too much post data.');
  let data;
  try { data = JSON.parse(text); } catch { throw instagramUnavailable(); }
  return instagramPostData(code, data);
}

/** @returns {import('./x-metadata.js').XMetadata} */
export function instagramVideoMetadata(code, index, post) {
  const media = post.media[index - 1];
  if (!media) throw new Error('The selected Instagram video is unavailable.');
  const author = String(post.product.user?.username || post.product.owner?.username || 'Instagram');
  const caption = String(post.product.caption?.text || post.product.edge_media_to_caption?.edges?.[0]?.node?.text || '').replace(/\s+/g, ' ').trim();
  const title = `${author} — ${caption || 'Instagram video'}`.slice(0, 170) + (post.media.length > 1 ? ` — ${index}` : '');
  const variants = media.video_versions || [{ url: media.video_url, width: media.dimensions?.width, height: media.dimensions?.height }];
  const seen = new Set();
  const formats = variants.flatMap(variant => {
    const url = instagramMediaURL(variant.url);
    const width = Number(variant.width || media.original_width), height = Number(variant.height || media.original_height);
    if (!url || !Number.isInteger(width) || !Number.isInteger(height) || Math.min(width, height) < 100 || Math.max(width, height) > 9999 || seen.has(url)) return [];
    seen.add(url);
    return [{ itag: seen.size, url, width, height: Math.min(width, height), quality_label: `${Math.min(width, height)}p`,
      mime_type: 'video/mp4', has_video: true, has_audio: true, bitrate: 0 }];
  });
  if (!formats.length) throw new Error('This Instagram video has no downloadable MP4 streams.');
  const thumbnail = safeMediaThumbnail(media.image_versions2?.candidates?.[0]?.url || media.display_url);
  return { provider: 'instagram', basic_info: { title, author, duration: Number(media.video_duration) || 0, thumbnail: [{ url: thumbnail }] }, streaming_data: { formats } };
}
