export const videoFormats = (info) => [
  ...(info.streaming_data?.formats || []),
  ...(info.streaming_data?.adaptive_formats || []),
].filter((format) => format.has_video && format.mime_type?.includes("video/mp4") && (format.url || format.signature_cipher || format.cipher));

export const matchingVideoFormats = (info, quality) => {
  const formats = videoFormats(info);
  if (!formats.length) {
    const error = new Error(info.playability_status?.reason || "No downloadable MP4 formats available.");
    error.code = 'FORMATS_UNAVAILABLE';
    throw error;
  }
  const exact = formats.filter((format) => format.quality_label === quality);
  const matching = exact.length ? exact : formats.filter((format) => parseInt(format.quality_label) === parseInt(quality));
  if (quality && !matching.length) {
    const error = new Error(`Requested ${quality} is unavailable. Available MP4 qualities: ${[...new Set(formats.map((format) => format.quality_label))].join(', ')}.`);
    error.code = 'QUALITY_UNAVAILABLE';
    throw error;
  }
  // An explicit resolution must survive client changes. Only unspecified quality
  // uses the default 360p selection.
  const fallback = formats.filter((format) => format.quality_label === "360p");
  const candidates = matching.length ? matching : fallback.length ? fallback : [...formats].sort((a, b) => a.height - b.height);
  return [...candidates].sort((a, b) => Number(b.has_audio) - Number(a.has_audio));
};

export const selectFormat = (info, quality) => matchingVideoFormats(info, quality)[0];

export const audioFormats = (info) => [
  ...(info.streaming_data?.adaptive_formats || []),
  ...(info.streaming_data?.formats || []),
].filter((format) => format.has_audio && (format.url || format.signature_cipher || format.cipher));

export const selectAudioFormat = (info) => {
  const formats = audioFormats(info);
  const audioOnly = formats.filter((format) => !format.has_video);
  const original = audioOnly.filter((format) => format.is_original);
  const candidates = original.length ? original : audioOnly.length ? audioOnly : formats;
  if (!candidates.length) throw new Error(info.playability_status?.reason || "No downloadable audio formats available.");
  return [...candidates].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
};

