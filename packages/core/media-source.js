import { getVideoOrListID } from './url-parser.js';

export const isInstagramVideoID = id => typeof id === 'string' && /^ig-[A-Za-z0-9_-]{5,32}-[1-9]\d?$/.test(id);
export const isProgressiveVideoID = id => isXVideoID(id) || isInstagramVideoID(id);

export const validMediaID = (id) => typeof id === 'string' && (/^[\w-]{11}$/.test(id) || /^x-[1-9]\d{14,19}-[1-4]$/.test(id) || isInstagramVideoID(id));
export const isXVideoID = (id) => typeof id === 'string' && /^x-[1-9]\d{14,19}-[1-4]$/.test(id);

/** Shared Node-free input validation for desktop, CLI, and mobile. */
export function parseMediaURL(input) {
  const invalid = () => new Error('Enter a valid YouTube, X, or Instagram URL.');
  if (typeof input !== 'string' || input.length > 2048) throw invalid();
  let url;
  try { url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`); }
  catch { throw invalid(); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw invalid();
  if (['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com', 'm.twitter.com'].includes(url.hostname.toLowerCase())) {
    const match = url.pathname.match(/^\/(?:(?:[\w]{1,15}|i\/web)\/status|i\/status|statuses)\/([1-9]\d{14,19})(?:\/video\/([1-4]))?\/?$/);
    if (!match) throw invalid();
    return { provider: 'x', type: 'video', id: `x-${match[1]}-${match[2] || 1}`, postId: match[1], selectedVideo: match[2] ? Number(match[2]) : undefined };
  }
  if (['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(url.hostname.toLowerCase())) {
    const match = url.pathname.match(/^\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]{5,32})\/?$/);
    if (!match) throw invalid();
    return { provider: 'instagram', type: 'video', id: `ig-${match[1]}-1`, postId: match[1] };
  }
  try { return { provider: 'youtube', ...getVideoOrListID(input) }; }
  catch { throw invalid(); }
}

export function safeMediaThumbnail(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && (['i.ytimg.com', 'pbs.twimg.com'].includes(url.hostname) || url.hostname.endsWith('.cdninstagram.com') || url.hostname.endsWith('.fbcdn.net')) ? url.href : undefined;
  } catch { return undefined; }
}
