import { audioFormats, qualityValue, videoFormats } from './formats.js';

/** @typedef {{video: Record<string, number | null>, mp3?: number}} SizeEstimates */
const positive = value => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= Number.MAX_SAFE_INTEGER ? number : undefined;
};
const safeBytes = value => {
  const number = positive(value);
  return number === undefined ? undefined : Math.ceil(number);
};
function streamBytes(format, duration) {
  const length = safeBytes(format?.content_length) || safeBytes(format?.estimated_content_length);
  if (length !== undefined) return length;
  const bitrate = positive(format?.average_bitrate) || positive(format?.bitrate);
  return bitrate && duration ? safeBytes(bitrate * duration / 8) : undefined;
}

/** Final-file estimates from existing metadata only; never fetch or decipher media.
 * Progressive MP4 already contains audio. Adaptive MP4 needs the companion audio
 * stream, and MP3 output uses the app's fixed 192 kbps encoding rate.
 * @returns {SizeEstimates}
 */
export function buildSizeEstimates(info) {
  const duration = positive(info?.basic_info?.duration);
  const formats = videoFormats(info);
  const audio = audioFormats(info).filter(format => !format.has_video && format.mime_type?.includes('audio/mp4'))
    .sort((a, b) => Number(!!b.is_original) - Number(!!a.is_original) || (b.bitrate || 0) - (a.bitrate || 0))[0];
  /** @type {Record<string, number | null>} */
  const video = {};
  for (const quality of new Set(formats.map(format => format.quality_label).filter(Boolean))) {
    const format = formats.filter(format => format.quality_label === quality)
      .sort((a, b) => Number(!!b.has_audio) - Number(!!a.has_audio))[0];
    const bytes = streamBytes(format, duration);
    const companion = format.has_audio ? 0 : streamBytes(audio, duration);
    // Retain unknown qualities explicitly so selecting Best never substitutes
    // the known size of a lower resolution for an unknown higher one.
    video[quality] = bytes !== undefined && companion !== undefined ? safeBytes(bytes + companion) ?? null : null;
  }
  const best = Object.keys(video).sort((a, b) => qualityValue(b) - qualityValue(a))[0];
  if (best) video.best = video[best];
  const mp3 = duration ? safeBytes(duration * 192000 / 8) : undefined;
  return { video, ...(mp3 !== undefined ? { mp3 } : {}) };
}

/** @param {SizeEstimates | undefined} sizes */
export function selectedSize(sizes, audio, quality) {
  if (!sizes) return undefined;
  if (audio) return positive(sizes.mp3);
  if (Object.prototype.hasOwnProperty.call(sizes.video, quality)) return positive(sizes.video[quality]);
  // A carousel may offer a quality that some selected items do not have. Match
  // the existing downloader's highest available lower-quality fallback.
  const lower = Object.keys(sizes.video).filter(value => value !== 'best' && qualityValue(value) < qualityValue(quality))
    .sort((a, b) => qualityValue(b) - qualityValue(a))[0];
  return lower ? positive(sizes.video[lower]) : undefined;
}

/** Unknown files never silently count as zero in a playlist total. */
export function summarizeSizes(items, audio, quality) {
  let bytes = 0, known = 0;
  for (const item of items) {
    const size = selectedSize(item?.sizeEstimates, audio, quality);
    if (size !== undefined && Number.isSafeInteger(bytes + size)) { bytes += size; known++; }
  }
  return { bytes, known, count: items.length };
}

export function formatFileSize(bytes, language = 'en') {
  if (!Number.isFinite(bytes) || bytes < 0) return undefined;
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes, unit = 0;
  while (value >= 1000 && unit < units.length - 1) { value /= 1000; unit++; }
  return `${new Intl.NumberFormat(language, { maximumFractionDigits: unit ? 1 : 0 }).format(value)} ${units[unit]}`;
}
const copy = {
  en: { label: 'Estimated file size', unknown: 'Size unavailable', empty: 'Select videos to see their total size',
    missing: 'The source did not provide enough size information.', varies: 'Actual file size may vary.',
    partial: 'Size available for {known} of {count} selected videos. Total size is incomplete.' },
  ar: { label: 'حجم الملف التقريبي', unknown: 'الحجم غير متاح', empty: 'حدد الفيديوهات لمعرفة حجمها الإجمالي',
    missing: 'لم يوفر المصدر معلومات كافية عن الحجم.', varies: 'قد يختلف حجم الملف الفعلي.',
    partial: 'الحجم متاح لـ {known} من أصل {count} فيديو محدد. الحجم الإجمالي غير مكتمل.' },
};
export function describeSize(summary, language = 'en') {
  const text = copy[language] || copy.en;
  const numbers = new Intl.NumberFormat(language);
  const partial = summary.known > 0 && summary.known < summary.count;
  return {
    label: text.label,
    value: !summary.count ? text.empty : !summary.known ? text.unknown : `≈ ${formatFileSize(summary.bytes, language)}${partial ? ' + ?' : ''}`,
    help: !summary.count ? '' : !summary.known ? text.missing : partial ? text.partial.replace('{known}', numbers.format(summary.known)).replace('{count}', numbers.format(summary.count)) : text.varies,
  };
}

/** Compact size text for every quality choice, before a quality is selected. */
export function qualitySizeLabel(items, quality, language = 'en') {
  const summary = summarizeSizes(items, false, quality);
  return summary.count ? describeSize(summary, language).value : '—';
}
