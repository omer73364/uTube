import { qualityValue } from './formats.js';
import { safeMediaThumbnail } from './media-source.js';

const hosts = ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'mbasic.facebook.com', 'web.facebook.com', 'fb.watch'];
export const facebookUnavailable = () => new Error('This Facebook video is unavailable or requires sign-in. Try a public video or Reel.');
export function facebookPageURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.includes(url.hostname)) return null;
    if (url.hostname === 'fb.watch') return /^\/[A-Za-z0-9_-]{3,100}\/?$/.test(url.pathname) ? url.href : null;
    if (/^\/(?:watch|video\.php)\/?$/.test(url.pathname) && /^[1-9]\d{4,24}$/.test(url.searchParams.get('v') || '')) return url.href;
    return /^\/(?:reel\/[1-9]\d{4,24}|(?:[\w.\-]+\/)?videos\/(?:[^/]+\/)?[1-9]\d{4,24}|share\/[vr]\/[A-Za-z0-9_-]{3,100})\/?$/.test(url.pathname) ? url.href : null;
  } catch { return null; }
}
export function facebookMediaURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && url.hostname.endsWith('.fbcdn.net') && url.pathname.endsWith('.mp4') ? url.href : null;
  } catch { return null; }
}
const sourceURL = key => /^[1-9]\d{4,24}$/.test(key) ? `https://www.facebook.com/watch/?v=${key}`
  : /^short-[A-Za-z0-9_-]{3,100}$/.test(key) ? `https://fb.watch/${key.slice(6)}/`
  : /^share-[vr]-[A-Za-z0-9_-]{3,100}$/.test(key) ? `https://www.facebook.com/share/${key[6]}/${key.slice(8)}/` : null;
const hasStreams = value => value && (value.browser_native_hd_url || value.browser_native_sd_url || value.playable_url || value.playable_url_quality_hd || value.videoDeliveryLegacyFields || value.videoDeliveryResponseFragment);
function findVideo(root, requestedID) {
  const pending = [root];
  let count = 0;
  while (pending.length && count++ < 100000) {
    const value = pending.pop();
    if (!value || typeof value !== 'object') continue;
    const id = String(value.videoId || value.id || '');
    if (/^[1-9]\d{4,24}$/.test(id) && (!requestedID || id === requestedID) && hasStreams(value)) return { id, video: value };
    pending.push(...Object.values(value).filter(item => item && typeof item === 'object'));
  }
}
const decodeText = text => text.replace(/&(?:#x([0-9a-f]+)|#([0-9]+)|(amp|quot|apos|lt|gt|nbsp));/gi, (entity, hex, decimal, name) => {
  if (hex || decimal) {
    const number = parseInt(hex || decimal, hex ? 16 : 10);
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : entity;
  }
  return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[name.toLowerCase()] || entity;
});
function pageTitle(html) {
  for (const property of ['og:description', 'og:title']) for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = Object.fromEntries([...match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(item => [item[1].toLowerCase(), item[2] ?? item[3]]));
    if ((attributes.property || attributes.name) === property && attributes.content) return decodeText(attributes.content);
  }
}
export function facebookPostData(html, requestedID) {
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try { data = JSON.parse(match[1]); } catch { continue; }
    const found = findVideo(data, requestedID);
    if (found) return { id: found.id, media: [{...found.video, name: found.video.name || pageTitle(html)}] };
  }
  throw facebookUnavailable();
}
export async function fetchFacebookPost(key, request, { signal } = {}) {
  let target = sourceURL(key);
  if (!target) throw new Error('Invalid Facebook link.');
  let requestedID = /^[1-9]\d{4,24}$/.test(key) ? key : undefined;
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (signal?.aborted) throw new Error('CANCELLED');
    const response = await request(target, { signal, headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } });
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers?.get('location');
      if (!location) throw facebookUnavailable();
      const next = facebookPageURL(new URL(location, target).href);
      if (!next) throw facebookUnavailable();
      target = next;
      const parsed = new URL(next);
      const canonicalID = parsed.searchParams.get('v') || parsed.pathname.match(/(?:reel|videos)\/(?:[^/]+\/)?([1-9]\d{4,24})\/?$/)?.[1];
      if (!requestedID && canonicalID) requestedID = canonicalID;
      continue;
    }
    if (response.status === 429) throw new Error('Facebook is limiting requests. Please try again later.');
    if (response.status !== 200) throw facebookUnavailable();
    const html = await response.text();
    if (html.length > 8 * 1024 * 1024) throw new Error('Facebook returned too much video data.');
    // A share page can contain recommendations; only accept its canonical video.
    if (!requestedID) {
      const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1];
      const page = canonical && facebookPageURL(canonical.replace(/&amp;/g, '&'));
      if (page) {
        const parsed = new URL(page);
        requestedID = parsed.searchParams.get('v') || parsed.pathname.match(/(?:reel|videos)\/(?:[^/]+\/)?([1-9]\d{4,24})\/?$/)?.[1];
      }
      if (!requestedID) throw facebookUnavailable();
    }
    return facebookPostData(html, requestedID);
  }
  throw facebookUnavailable();
}

/** @returns {import('./x-metadata.js').XMetadata} */
export function facebookVideoMetadata(_key, index, post) {
  const video = post.media[index - 1];
  if (!video || index !== 1 || video.is_live_streaming === true) throw facebookUnavailable();
  const legacy = video.videoDeliveryLegacyFields || video;
  const progressive = video.videoDeliveryResponseFragment?.videoDeliveryResponseResult?.progressive_urls;
  const variants = [
    ...['browser_native_sd_url','playable_url'].map(key => ({url:legacy[key],quality:'SD'})),
    ...['browser_native_hd_url','playable_url_quality_hd'].map(key => ({url:legacy[key],quality:'HD'})),
    ...(Array.isArray(progressive) ? progressive.map(item => ({url:item.progressive_url,quality:String(item.metadata?.quality || '').toUpperCase(),width:item.metadata?.width,height:item.metadata?.height})) : []),
  ];
  const seen = new Set();
  const formats = variants.flatMap(variant => {
    const url = facebookMediaURL(variant.url);
    if (!url || seen.has(url)) return [];
    const edge = Math.min(Number(variant.width), Number(variant.height));
    const quality = Number.isInteger(edge) && edge >= 100 && edge <= 9999 ? `${edge}p` : ['SD','HD'].includes(variant.quality) ? variant.quality : undefined;
    if (!quality) return [];
    seen.add(url);
    return [{itag:seen.size,url,width:Number(variant.width)||0,height:Number(variant.height)||0,quality_label:quality,estimated_content_length:post.mediaSizes?.[url],mime_type:'video/mp4',has_video:true,has_audio:true,bitrate:0}];
  });
  formats.sort((a,b) => qualityValue(b.quality_label) - qualityValue(a.quality_label));
  if (!formats.length) throw new Error('This Facebook video has no downloadable MP4 streams. Live videos and streaming-only videos are not supported.');
  const title = String(video.name || video.title?.text || video.savable_description?.text || `Facebook video ${post.id}`).replace(/\s+/g,' ').trim().slice(0,180);
  return {provider:'facebook',basic_info:{title,author:String(video.owner?.name || 'Facebook'),duration:Number(video.playable_duration_in_ms)/1000 || Number(video.length_in_second)||0,
    thumbnail:[{url:safeMediaThumbnail(video.thumbnailImage?.uri || video.preferred_thumbnail?.image?.uri)}]},streaming_data:{formats}};
}
