import { parseMediaURL, validMediaID, safeMediaThumbnail } from '../../../../packages/core/media-source.js';
export function validateURL(value) {
  parseMediaURL(value);
  return value.trim();
}
export function validateRequest(value) {
  if (!value || typeof value.audio !== 'boolean' || !Array.isArray(value.items) || !value.items.length || value.items.length > 500) throw new Error('Choose between 1 and 500 videos.');
  if (value.quality !== undefined && (typeof value.quality !== 'string' || !/^\d{3,4}p(?:\d{2,3})?$/.test(value.quality))) throw new Error('Choose a valid video quality.');
  if (value.audio && value.quality !== undefined) throw new Error('MP3 does not use video quality.');
  if (!value.audio && !value.quality) throw new Error('Choose a video quality.');
  if (value.playlistTitle !== undefined && (typeof value.playlistTitle !== 'string' || value.playlistTitle.length > 500)) throw new Error('Invalid playlist title.');
  return {
    audio: value.audio, quality: value.quality, playlistTitle: value.playlistTitle,
    items: value.items.map((item, index) => {
      if (!item || !validMediaID(item.id) || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 1000 || (item.index !== undefined && (!Number.isInteger(item.index) || item.index < 0 || item.index > 100000))) throw new Error('Invalid playlist item.');
      return { id: item.id, title: item.title, index: item.index ?? index, thumbnail: safeMediaThumbnail(item.thumbnail) };
    }),
  };
}
export function validateJobID(value) {
  if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/.test(value)) throw new Error('Invalid download.');
  return value;
}
